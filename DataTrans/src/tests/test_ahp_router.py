from pathlib import Path
import sys
from types import SimpleNamespace

import pytest
from fastapi import BackgroundTasks, HTTPException

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ahp_contracts import (
    AhpRequest,
    AhpIntentProfile,
    AhpIntakeRequest,
    AhpIntakeResponse,
    ApartmentChatRequest,
    ApartmentChatResponse,
    CompareApartmentAnalysisItem,
    CompareRequest,
    CompareResponse,
    CriterionScoreBreakdown,
    LlmAnalysis,
    LlmApartmentAnalysisItem,
)
from models import AhpResult, AhpSession, CanHo
from routers import ahp as ahp_router


def make_listing(canho_id: int, total_score: float):
    return SimpleNamespace(
        id=canho_id,
        ma_tin=f"CH-{canho_id}",
        url=f"https://example.com/{canho_id}",
        title=f"Can ho {canho_id}",
        ngay_dang=None,
        ngay_het_han=None,
        thumbnail_url=None,
        thumbnail_path=None,
        image_urls=[],
        image_local_paths=[],
        thumbnail_src=None,
        image_srcs=[],
        gia_ty=2.5 + canho_id / 10,
        gia_per_m2=45 + canho_id,
        dien_tich=60 + canho_id,
        so_phong_ngu=2,
        so_phong_wc=2,
        noi_that="Day du",
        du_an=f"Du an {canho_id}",
        phap_ly="So hong",
        tien_ich_ha_tang="benh vien|truong hoc|metro",
        tien_ich_noi_khu="ho boi|gym|bai xe",
        huong_nha="Dong Nam",
        huong_ban_cong="Nam",
        phuong="Phuong 1",
        trang_thai=True,
        mock_total=total_score,
    )


class FakeQuery:
    def __init__(self, items):
        self.items = list(items)

    def filter(self, *args, **kwargs):
        return self

    def order_by(self, *args, **kwargs):
        return self

    def offset(self, *args, **kwargs):
        return self

    def limit(self, *args, **kwargs):
        return self

    def all(self):
        return list(self.items)

    def first(self):
        return self.items[0] if self.items else None


class FakeDB:
    def __init__(self, canhos=None, session=None, results=None):
        self.canhos = list(canhos or [])
        self.session = session
        self.results = list(results or [])
        self.saved_session = None
        self.bulk_saved = []

    def query(self, model):
        if model is CanHo:
            return FakeQuery(self.canhos)
        if model is AhpSession:
            return FakeQuery([self.session] if self.session else [])
        if model is AhpResult:
            return FakeQuery(self.results)
        raise AssertionError(f"Unexpected model query: {model}")

    def add(self, obj):
        self.saved_session = obj

    def flush(self):
        if self.saved_session is not None and getattr(self.saved_session, "id", None) is None:
            self.saved_session.id = 1

    def bulk_save_objects(self, objects):
        self.bulk_saved = list(objects)

    def commit(self):
        return None


def fake_calc_weights(matrix):
    return {
        "weights": [0.125] * 8,
        "lambda_max": 8.0,
        "ci": 0.0,
        "cr": 0.01,
        "cr_ok": True,
    }


def fake_score_canho(ch, weights):
    return {
        "total": ch.mock_total,
        "detail": {f"C{i}": round(0.4 + i * 0.02, 4) for i in range(1, 9)},
    }


def make_session(session_id: int = 7):
    return SimpleNamespace(
        id=session_id,
        ten_phien="Session AHP",
        cr=0.02,
        ci=0.01,
        lambda_max=8.01,
        cr_ok=True,
        ma_tran=[[1] * 8 for _ in range(8)],
        weights=[0.125] * 8,
        created_at=None,
        llm_model=None,
        llm_status=None,
        llm_output=None,
        llm_error=None,
        llm_generated_at=None,
    )


def make_result(rank: int, listing):
    return SimpleNamespace(
        rank=rank,
        canho_id=listing.id,
        ahp_score=listing.mock_total,
        score_detail={f"C{i}": 0.4 + i * 0.02 for i in range(1, 9)},
        canho=listing,
    )


def make_compare_response(session_id: int, compared_ids: list[int]):
    return CompareResponse(
        status="success",
        model="openai/gpt-4o-mini",
        session_id=session_id,
        compared_ids=compared_ids,
        summary="Tong quat so sanh cac can da chon.",
        winner_id=compared_ids[0],
        winner_reason="Can dung dau can bang gia, phap ly va vi tri.",
        tradeoffs=["Gia tot nhung noi that khac nhau."],
        apartments=[
            CompareApartmentAnalysisItem(
                canho_id=canho_id,
                llm_support_score=85 - index,
                verdict=f"Can {canho_id} phu hop voi uu tien hien tai.",
                strengths=["Gia hop ly", "Phap ly ro rang"],
                risks=["Can kiem tra them tien ich xung quanh"],
                criterion_scores=CriterionScoreBreakdown(
                    C1=80,
                    C2=75,
                    C3=72,
                    C4=88,
                    C5=70,
                    C6=69,
                    C7=73,
                    C8=66,
                ),
            )
            for index, canho_id in enumerate(compared_ids)
        ],
        error=None,
    )


def make_chat_response(session_id: int, canho_id: int):
    return ApartmentChatResponse(
        status="success",
        model="openai/gpt-4o-mini",
        session_id=session_id,
        canho_id=canho_id,
        answer="Căn này hợp để ở nhờ pháp lý rõ ràng và mặt bằng khá cân bằng.",
        suggested_questions=[
            "Căn này phù hợp để ở điểm nào?",
            "Đi xem thực tế nên kiểm tra gì trước?",
            "Điểm cần cân nhắc của căn này là gì?",
        ],
        refusal_reason=None,
        error=None,
    )


def make_intake_response():
    return AhpIntakeResponse(
        status="success",
        model="openai/gpt-4o-mini",
        intent_profile=AhpIntentProfile(
            goal="Tìm căn hộ để ở cho gia đình nhỏ.",
            budget="Khoảng 3.5 tỷ",
            preferred_area="Quận 7 hoặc khu lân cận",
            bedroom_need="Cần 3 phòng ngủ",
            top_priorities=["Pháp lý rõ ràng", "Di chuyển thuận tiện", "Không gian ở thoải mái"],
            deal_breakers=["Không muốn pháp lý mơ hồ"],
        ),
        recommended_preset="legal",
        suggested_weights=[
            ahp_router.CriterionWeight(id="C1", name="Tài chính", weight=0.14, pct=14.0),
            ahp_router.CriterionWeight(id="C2", name="Nội thất", weight=0.11, pct=11.0),
            ahp_router.CriterionWeight(id="C3", name="Chủ đầu tư", weight=0.08, pct=8.0),
            ahp_router.CriterionWeight(id="C4", name="Pháp lý", weight=0.2, pct=20.0),
            ahp_router.CriterionWeight(id="C5", name="Hạ tầng xã hội", weight=0.13, pct=13.0),
            ahp_router.CriterionWeight(id="C6", name="Tiện ích nội khu", weight=0.12, pct=12.0),
            ahp_router.CriterionWeight(id="C7", name="Ngoại thất", weight=0.1, pct=10.0),
            ahp_router.CriterionWeight(id="C8", name="Phong thủy", weight=0.12, pct=12.0),
        ],
        explanation="AI đang hiểu bạn ưu tiên an cư ổn định nên gợi ý bắt đầu từ pháp lý và tiện ích sống.",
        error=None,
    )


def make_llm_analysis(listings):
    return LlmAnalysis(
        status="success",
        model="openai/gpt-4o-mini",
        top_k=len(listings),
        summary="Top 10 đang nghiêng về nhóm căn hộ cân bằng giữa giá, pháp lý và tiện ích sống.",
        winner_reason="Căn đứng đầu giữ lợi thế nhờ mặt bằng sống dễ ở và điểm AHP tốt hơn phần còn lại.",
        tradeoffs=["Nhóm giá mềm hơn thường phải đánh đổi một phần về pháp lý hoặc tiện ích."],
        apartments=[
            LlmApartmentAnalysisItem(
                rank=index,
                canho_id=listing.id,
                llm_support_score=84 - index,
                verdict=f"Can {listing.id} phu hop de o trong nhom dang can nhac.",
                strengths=["Gia hop ly", "Tien ich song on"],
                risks=["Can xem ky phap ly"],
                criterion_scores=CriterionScoreBreakdown(
                    C1=80,
                    C2=78,
                    C3=75,
                    C4=82,
                    C5=74,
                    C6=76,
                    C7=79,
                    C8=73,
                ),
            )
            for index, listing in enumerate(listings, start=1)
        ],
        error=None,
    )


def test_ahp_score_returns_pure_ahp_response(monkeypatch):
    listings = [
        make_listing(1, 0.92),
        make_listing(2, 0.81),
        make_listing(3, 0.76),
    ]
    db = FakeDB(canhos=listings)

    monkeypatch.setattr(ahp_router, "calc_weights", fake_calc_weights)
    monkeypatch.setattr(ahp_router, "score_canho", fake_score_canho)
    monkeypatch.setattr(ahp_router, "attach_media_sources", lambda canho: canho)
    monkeypatch.setattr(ahp_router, "analyze_ranked_apartments", lambda **kwargs: make_llm_analysis(listings))

    response = ahp_router.ahp_score(
        payload=AhpRequest(ten_phien="Test", matrix=[[1] * 8 for _ in range(8)]),
        background_tasks=BackgroundTasks(),
        db=db,
    )

    assert response.session_id == 1
    assert response.total_canho == 3
    assert response.ranked[0].canho.id == 1
    assert response.llm_analysis.status == "success"
    assert len(db.bulk_saved) == 3


def test_ahp_intake_returns_success(monkeypatch):
    monkeypatch.setattr(ahp_router, "generate_ahp_intake_guidance", lambda **kwargs: make_intake_response())

    response = ahp_router.ahp_intake(
        payload=AhpIntakeRequest(
            user_input="Mình mua để ở, tầm 3.5 tỷ, cần 3PN và ưu tiên pháp lý rõ ràng.",
            llm_model="openai/gpt-4o-mini",
        )
    )

    assert response.status == "success"
    assert response.recommended_preset == "legal"
    assert len(response.suggested_weights) == 8
    assert response.intent_profile


@pytest.mark.parametrize("selected_ids", [[1, 2], [1, 2, 3, 4]])
def test_compare_apartments_returns_llm_success(monkeypatch, selected_ids):
    listings = [make_listing(index, 0.95 - index * 0.03) for index in range(1, 6)]
    session = make_session(session_id=9)
    results = [make_result(rank, listing) for rank, listing in enumerate(listings, start=1)]
    db = FakeDB(session=session, results=results)

    monkeypatch.setattr(ahp_router, "attach_media_sources", lambda canho: canho)
    monkeypatch.setattr(
        ahp_router,
        "analyze_compared_apartments",
        lambda **kwargs: make_compare_response(kwargs["session_id"], [item.canho.id for item in kwargs["apartments"]]),
    )

    response = ahp_router.compare_apartments(
        payload=CompareRequest(session_id=9, canho_ids=selected_ids, llm_model="openai/gpt-4o-mini"),
        db=db,
    )

    assert response.status == "success"
    assert response.session_id == 9
    assert response.compared_ids == selected_ids
    assert len(response.apartments) == len(selected_ids)


def test_compare_apartments_rejects_listing_outside_top10(monkeypatch):
    listings = [make_listing(index, 0.98 - index * 0.02) for index in range(1, 12)]
    session = make_session(session_id=5)
    results = [make_result(rank, listing) for rank, listing in enumerate(listings, start=1)]
    db = FakeDB(session=session, results=results)

    monkeypatch.setattr(ahp_router, "attach_media_sources", lambda canho: canho)

    with pytest.raises(HTTPException) as exc_info:
        ahp_router.compare_apartments(
            payload=CompareRequest(session_id=5, canho_ids=[1, 11], llm_model="openai/gpt-4o-mini"),
            db=db,
        )

    assert exc_info.value.status_code == 400
    assert "Top 10" in exc_info.value.detail


def test_get_session_restores_llm_analysis(monkeypatch):
    listing = make_listing(21, 0.88)
    session = make_session(session_id=7)
    results = [make_result(1, listing)]
    db = FakeDB(session=session, results=results)
    llm_analysis = make_llm_analysis([listing])

    session.llm_output = llm_analysis.model_dump()
    session.llm_model = llm_analysis.model
    session.llm_status = llm_analysis.status
    session.llm_error = llm_analysis.error

    monkeypatch.setattr(ahp_router, "attach_media_sources", lambda canho: canho)

    response = ahp_router.get_session(session_id=7, db=db)

    assert response.session_id == 7
    assert response.ranked[0].canho.id == 21
    assert response.llm_analysis.status == "success"
    assert response.llm_analysis.summary == llm_analysis.summary


def test_chat_apartment_returns_success(monkeypatch):
    listings = [make_listing(index, 0.95 - index * 0.03) for index in range(1, 6)]
    session = make_session(session_id=14)
    results = [make_result(rank, listing) for rank, listing in enumerate(listings, start=1)]
    db = FakeDB(session=session, results=results)

    monkeypatch.setattr(ahp_router, "attach_media_sources", lambda canho: canho)
    monkeypatch.setattr(
        ahp_router,
        "chat_about_apartment",
        lambda **kwargs: make_chat_response(kwargs["session_id"], kwargs["apartment"].canho.id),
    )

    response = ahp_router.chat_apartment(
        payload=ApartmentChatRequest(
            session_id=14,
            canho_id=2,
            question="Căn này phù hợp để ở điểm nào?",
            llm_model="openai/gpt-4o-mini",
            history=[],
        ),
        db=db,
    )

    assert response.status == "success"
    assert response.session_id == 14
    assert response.canho_id == 2
    assert response.answer


def test_chat_apartment_rejects_listing_outside_session(monkeypatch):
    listings = [make_listing(index, 0.95 - index * 0.03) for index in range(1, 4)]
    session = make_session(session_id=15)
    results = [make_result(rank, listing) for rank, listing in enumerate(listings, start=1)]
    db = FakeDB(session=session, results=results)

    monkeypatch.setattr(ahp_router, "attach_media_sources", lambda canho: canho)

    with pytest.raises(HTTPException) as exc_info:
        ahp_router.chat_apartment(
            payload=ApartmentChatRequest(
                session_id=15,
                canho_id=99,
                question="Căn này có gì nổi bật?",
                llm_model="openai/gpt-4o-mini",
                history=[],
            ),
            db=db,
        )

    assert exc_info.value.status_code == 400
    assert "phien AHP" in exc_info.value.detail


def test_chat_apartment_missing_session(monkeypatch):
    listing = make_listing(1, 0.9)
    result = make_result(1, listing)
    db = FakeDB(session=None, results=[result])

    monkeypatch.setattr(ahp_router, "attach_media_sources", lambda canho: canho)

    with pytest.raises(HTTPException) as exc_info:
        ahp_router.chat_apartment(
            payload=ApartmentChatRequest(
                session_id=77,
                canho_id=1,
                question="Căn này hợp để ở không?",
                llm_model="openai/gpt-4o-mini",
                history=[],
            ),
            db=db,
        )

    assert exc_info.value.status_code == 404
