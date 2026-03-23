"""
routers/ahp.py
POST /ahp/score        — nhận ma trận 8×8, tính AHP, xếp hạng, lưu DB
GET  /ahp/sessions     — lịch sử các phiên AHP
GET  /ahp/sessions/{id} — kết quả xếp hạng của 1 phiên cũ
"""
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from database import get_db
from models import CanHo, AhpSession, AhpResult
from schema import AhpRequest, AhpResponse, CriterionWeight, RankedCanHo, CanHoOut, SessionSummary
from services.ahp_engine import calc_weights, score_canho, CRITERIA
from data_pipeline import run_data_pipeline

router = APIRouter(prefix="/ahp", tags=["AHP"])


# ─── POST /ahp/score ──────────────────────────────────────────────────────────
@router.post("/score", response_model=AhpResponse)
def ahp_score(payload: AhpRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    # Chạy pipeline trong background để cập nhật data nếu cần
    background_tasks.add_task(run_data_pipeline)
    
    canhos = db.query(CanHo).filter(CanHo.trang_thai == True).all()
    if not canhos:
        raise HTTPException(status_code=404, detail="Không có căn hộ nào đang hoạt động để đánh giá. Vui lòng thử lại sau khi dữ liệu được cập nhật.")
    
    # 1. Tính AHP
    ahp = calc_weights(payload.matrix)

    if not ahp["cr_ok"]:
        raise HTTPException(
            status_code=422,
            detail={
                "msg": f"CR = {ahp['cr']*100:.2f}% > 10%. Ma trận chưa nhất quán, hãy điều chỉnh lại.",
                "cr":  ahp["cr"],
                "ci":  ahp["ci"],
            }
        )

    weights = ahp["weights"]

    # 2. Lưu session
    session = AhpSession(
        ten_phien  = payload.ten_phien,
        ma_tran    = payload.matrix,
        weights    = weights,
        lambda_max = ahp["lambda_max"],
        ci         = ahp["ci"],
        cr         = ahp["cr"],
        cr_ok      = ahp["cr_ok"],
    )
    db.add(session)
    db.flush()   # lấy session.id ngay, chưa commit

    # 3. Tính điểm toàn bộ căn hộ
    canhos = db.query(CanHo).all()

    scored = []
    for ch in canhos:
        result = score_canho(ch, weights)
        scored.append((ch, result["total"], result["detail"]))

    # 4. Xếp hạng (điểm cao → thấp)
    scored.sort(key=lambda x: x[1], reverse=True)

    # 5. Lưu kết quả
    bulk = []
    for rank, (ch, total, detail) in enumerate(scored, start=1):
        bulk.append(AhpResult(
            session_id   = session.id,
            canho_id     = ch.id,
            ahp_score    = total,
            rank         = rank,
            score_detail = detail,
        ))
    db.bulk_save_objects(bulk)
    db.commit()

    # 6. Trả response
    criterion_weights = [
        CriterionWeight(
            id=c["id"], name=c["name"],
            weight=weights[i], pct=round(weights[i]*100, 2)
        )
        for i, c in enumerate(CRITERIA)
    ]

    ranked = [
        RankedCanHo(
            rank=rank,
            ahp_score=round(total, 4),
            score_detail=detail,
            canho=CanHoOut.model_validate(ch),
        )
        for rank, (ch, total, detail) in enumerate(scored, start=1)
    ]

    return AhpResponse(
        session_id  = session.id,
        ten_phien   = session.ten_phien,
        cr          = ahp["cr"],
        ci          = ahp["ci"],
        lambda_max  = ahp["lambda_max"],
        cr_ok       = ahp["cr_ok"],
        weights     = criterion_weights,
        total_canho = len(scored),
        ranked      = ranked,
    )


# ─── GET /ahp/sessions ────────────────────────────────────────────────────────
@router.get("/sessions", response_model=list[SessionSummary])
def list_sessions(skip: int = 0, limit: int = 20, db: Session = Depends(get_db)):
    return (
        db.query(AhpSession)
        .order_by(AhpSession.created_at.desc())
        .offset(skip).limit(limit)
        .all()
    )


# ─── GET /ahp/sessions/{id} ───────────────────────────────────────────────────
@router.get("/sessions/{session_id}", response_model=AhpResponse)
def get_session(session_id: int, db: Session = Depends(get_db)):
    session = db.query(AhpSession).filter(AhpSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên AHP")

    results = (
        db.query(AhpResult)
        .filter(AhpResult.session_id == session_id)
        .order_by(AhpResult.rank)
        .all()
    )

    weights = session.weights
    criterion_weights = [
        CriterionWeight(
            id=c["id"], name=c["name"],
            weight=weights[i], pct=round(weights[i]*100, 2)
        )
        for i, c in enumerate(CRITERIA)
    ]

    ranked = [
        RankedCanHo(
            rank=r.rank,
            ahp_score=float(r.ahp_score),
            score_detail=r.score_detail or {},
            canho=CanHoOut.model_validate(r.canho),
        )
        for r in results
    ]

    return AhpResponse(
        session_id  = session.id,
        ten_phien   = session.ten_phien,
        cr          = float(session.cr),
        ci          = float(session.ci),
        lambda_max  = float(session.lambda_max),
        cr_ok       = session.cr_ok,
        weights     = criterion_weights,
        total_canho = len(ranked),
        ranked      = ranked,
    )