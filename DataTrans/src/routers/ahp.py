"""
AHP routes.
"""

from datetime import datetime

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.orm import Session

from ahp_contracts import (
    AhpRequest,
    AhpResponse,
    AhpIntakeRequest,
    AhpIntakeResponse,
    ApartmentChatRequest,
    ApartmentChatResponse,
    CompareRequest,
    CompareResponse,
)
from data_pipeline import run_data_pipeline
from database import get_db
from media_resolver import attach_media_sources
from models import AhpResult, AhpSession, CanHo
from schema import CanHoOut, CriterionWeight, RankedCanHo, SessionSummary
from services.apartment_chat_openrouter_service import chat_about_apartment
from services.ahp_engine import CRITERIA, calc_weights, score_canho
from services.compare_openrouter_service import analyze_compared_apartments
from services.intake_openrouter_service import generate_ahp_intake_guidance
from services.openrouter_service import analyze_ranked_apartments, restore_llm_analysis

router = APIRouter(prefix="/ahp", tags=["AHP"])


@router.post("/score", response_model=AhpResponse)
def ahp_score(
    payload: AhpRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    background_tasks.add_task(run_data_pipeline)

    canhos = db.query(CanHo).filter(CanHo.trang_thai.is_(True)).all()
    if not canhos:
        raise HTTPException(
            status_code=404,
            detail="Khong co can ho nao dang hoat dong de danh gia.",
        )

    ahp = calc_weights(payload.matrix)
    if not ahp["cr_ok"]:
        raise HTTPException(
            status_code=422,
            detail={
                "msg": f"CR = {ahp['cr'] * 100:.2f}% > 10%. Ma tran chua nhat quan, hay dieu chinh lai.",
                "cr": ahp["cr"],
                "ci": ahp["ci"],
            },
        )

    weights = ahp["weights"]
    session = AhpSession(
        ten_phien=payload.ten_phien,
        ma_tran=payload.matrix,
        weights=weights,
        lambda_max=ahp["lambda_max"],
        ci=ahp["ci"],
        cr=ahp["cr"],
        cr_ok=ahp["cr_ok"],
    )
    db.add(session)
    db.flush()

    scored = []
    for canho in canhos:
        result = score_canho(canho, weights)
        scored.append((canho, result["total"], result["detail"]))

    scored.sort(key=lambda item: item[1], reverse=True)

    criterion_weights = _build_criterion_weights(weights)
    ranked = [
        _build_ranked_item(rank, canho, total, detail)
        for rank, (canho, total, detail) in enumerate(scored, start=1)
    ]
    llm_analysis = analyze_ranked_apartments(
        ranked=ranked,
        weights=criterion_weights,
        requested_model=payload.llm_model,
        enabled=payload.llm_enabled,
    )

    db.bulk_save_objects(
        [
            AhpResult(
                session_id=session.id,
                canho_id=canho.id,
                ahp_score=total,
                rank=rank,
                score_detail=detail,
            )
            for rank, (canho, total, detail) in enumerate(scored, start=1)
        ],
    )
    session.llm_model = llm_analysis.model
    session.llm_status = llm_analysis.status
    session.llm_output = llm_analysis.model_dump()
    session.llm_error = llm_analysis.error
    session.llm_generated_at = datetime.now()
    db.commit()

    return AhpResponse(
        session_id=session.id,
        ten_phien=session.ten_phien,
        cr=ahp["cr"],
        ci=ahp["ci"],
        lambda_max=ahp["lambda_max"],
        cr_ok=ahp["cr_ok"],
        criteria_matrix=payload.matrix,
        weights=criterion_weights,
        total_canho=len(scored),
        ranked=ranked,
        llm_analysis=llm_analysis,
    )


@router.post("/intake", response_model=AhpIntakeResponse)
def ahp_intake(payload: AhpIntakeRequest):
    return generate_ahp_intake_guidance(
        user_input=payload.user_input,
        requested_model=payload.llm_model,
    )


@router.post("/compare", response_model=CompareResponse)
def compare_apartments(payload: CompareRequest, db: Session = Depends(get_db)):
    session = db.query(AhpSession).filter(AhpSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Khong tim thay phien AHP")

    results = (
        db.query(AhpResult)
        .filter(AhpResult.session_id == payload.session_id)
        .order_by(AhpResult.rank)
        .all()
    )
    if not results:
        raise HTTPException(status_code=404, detail="Phien AHP nay chua co ket qua xep hang")

    top_results = results[:10]
    top_by_id = {result.canho_id: result for result in top_results}
    invalid_ids = [canho_id for canho_id in payload.canho_ids if canho_id not in top_by_id]
    if invalid_ids:
        raise HTTPException(
            status_code=400,
            detail="Chi duoc so sanh cac can ho thuoc Top 10 cua phien AHP da chon.",
        )

    compared_ranked = [
        _build_ranked_item(
            rank=result.rank,
            canho=result.canho,
            total=float(result.ahp_score),
            detail=result.score_detail or {},
        )
        for result in top_results
        if result.canho_id in payload.canho_ids
    ]

    if len(compared_ranked) != len(payload.canho_ids):
        raise HTTPException(status_code=400, detail="Khong the tai du du lieu de so sanh cac can da chon.")

    return analyze_compared_apartments(
        session_id=session.id,
        apartments=compared_ranked,
        weights=_build_criterion_weights(session.weights),
        requested_model=payload.llm_model,
    )


@router.post("/chat-apartment", response_model=ApartmentChatResponse)
def chat_apartment(payload: ApartmentChatRequest, db: Session = Depends(get_db)):
    session = db.query(AhpSession).filter(AhpSession.id == payload.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Khong tim thay phien AHP")

    results = (
        db.query(AhpResult)
        .filter(AhpResult.session_id == payload.session_id)
        .order_by(AhpResult.rank)
        .all()
    )
    if not results:
        raise HTTPException(status_code=404, detail="Phien AHP nay chua co ket qua xep hang")

    target_result = next((result for result in results if result.canho_id == payload.canho_id), None)
    if not target_result:
        raise HTTPException(
            status_code=400,
            detail="Can ho nay khong thuoc phien AHP hien tai.",
        )

    apartment = _build_ranked_item(
        rank=target_result.rank,
        canho=target_result.canho,
        total=float(target_result.ahp_score),
        detail=target_result.score_detail or {},
    )
    top_context = [
        _build_ranked_item(
            rank=result.rank,
            canho=result.canho,
            total=float(result.ahp_score),
            detail=result.score_detail or {},
        )
        for result in results[:3]
    ]

    return chat_about_apartment(
        session_id=session.id,
        apartment=apartment,
        weights=_build_criterion_weights(session.weights),
        top_context=top_context,
        question=payload.question,
        requested_model=payload.llm_model,
        history=payload.history,
    )


@router.get("/sessions", response_model=list[SessionSummary])
def list_sessions(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return (
        db.query(AhpSession)
        .order_by(AhpSession.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


@router.get("/sessions/{session_id}", response_model=AhpResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(AhpSession).filter(AhpSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Khong tim thay phien AHP")

    results = (
        db.query(AhpResult)
        .filter(AhpResult.session_id == session_id)
        .order_by(AhpResult.rank)
        .all()
    )

    ranked = [
        _build_ranked_item(
            rank=result.rank,
            canho=result.canho,
            total=float(result.ahp_score),
            detail=result.score_detail or {},
        )
        for result in results
    ]

    return AhpResponse(
        session_id=session.id,
        ten_phien=session.ten_phien,
        cr=float(session.cr),
        ci=float(session.ci),
        lambda_max=float(session.lambda_max),
        cr_ok=session.cr_ok,
        criteria_matrix=session.ma_tran,
        weights=_build_criterion_weights(session.weights),
        total_canho=len(ranked),
        ranked=ranked,
        llm_analysis=restore_llm_analysis(
            raw_output=session.llm_output,
            model=session.llm_model,
            status=session.llm_status,
            error=session.llm_error,
        ),
    )


def _build_criterion_weights(weights: list[float]) -> list[CriterionWeight]:
    return [
        CriterionWeight(
            id=criterion["id"],
            name=criterion["name"],
            weight=weights[index],
            pct=round(weights[index] * 100, 2),
        )
        for index, criterion in enumerate(CRITERIA)
    ]


def _build_ranked_item(rank: int, canho: CanHo, total: float, detail: dict) -> RankedCanHo:
    return RankedCanHo(
        rank=rank,
        ahp_score=round(float(total), 4),
        score_detail=detail,
        canho=CanHoOut.model_validate(attach_media_sources(canho)),
    )
