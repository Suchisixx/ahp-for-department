from pathlib import Path
import sys

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ahp_contracts import ApartmentChatMessage
from schema import CanHoOut, CriterionWeight, RankedCanHo
from services import apartment_chat_openrouter_service


def make_ranked_apartment(rank: int, canho_id: int, ahp_score: float = 0.8):
    canho = CanHoOut(
        id=canho_id,
        ma_tin=f"CH-{canho_id}",
        title=f"Can ho {canho_id}",
        du_an=f"Du an {canho_id}",
        phuong="Phuong 1",
        gia_ty=3.2,
        gia_per_m2=52,
        dien_tich=68,
        so_phong_ngu=2,
        so_phong_wc=2,
        noi_that="Day du",
        phap_ly="So hong",
        tien_ich_ha_tang="benh vien|truong hoc|metro",
        tien_ich_noi_khu="ho boi|gym|bai xe",
        huong_nha="Dong Nam",
        huong_ban_cong="Nam",
        url=f"https://example.com/{canho_id}",
    )
    return RankedCanHo(
        rank=rank,
        ahp_score=ahp_score,
        score_detail={f"C{i}": round(0.45 + i * 0.03, 4) for i in range(1, 9)},
        canho=canho,
    )


def make_weights():
    return [
        CriterionWeight(id=f"C{i}", name=f"Tieu chi {i}", weight=0.125, pct=12.5)
        for i in range(1, 9)
    ]


class FakeResponse:
    def __init__(self, payload, ok=True, status_code=200):
        self._payload = payload
        self.ok = ok
        self.status_code = status_code

    def json(self):
        return self._payload


def test_chat_about_apartment_timeout_returns_failed(monkeypatch):
    monkeypatch.setattr(apartment_chat_openrouter_service.settings, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(apartment_chat_openrouter_service.settings, "OPENROUTER_DEFAULT_MODEL", "minimax/minimax-m2.5")

    def raise_timeout(*args, **kwargs):
        raise requests.Timeout("deadline")

    monkeypatch.setattr(apartment_chat_openrouter_service.requests, "post", raise_timeout)

    response = apartment_chat_openrouter_service.chat_about_apartment(
        session_id=7,
        apartment=make_ranked_apartment(2, 202),
        weights=make_weights(),
        top_context=[make_ranked_apartment(1, 201), make_ranked_apartment(2, 202)],
        question="Can nay phu hop de o diem nao?",
        requested_model=None,
        history=[],
    )

    assert response.status == "failed"
    assert response.canho_id == 202
    assert "quá thời gian" in response.error.lower()


def test_chat_about_apartment_invalid_json_returns_failed(monkeypatch):
    monkeypatch.setattr(apartment_chat_openrouter_service.settings, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(apartment_chat_openrouter_service.settings, "OPENROUTER_DEFAULT_MODEL", "minimax/minimax-m2.5")
    monkeypatch.setattr(
        apartment_chat_openrouter_service.requests,
        "post",
        lambda *args, **kwargs: FakeResponse(
            {"choices": [{"message": {"content": "not-a-json"}}]}
        ),
    )

    response = apartment_chat_openrouter_service.chat_about_apartment(
        session_id=7,
        apartment=make_ranked_apartment(2, 202),
        weights=make_weights(),
        top_context=[make_ranked_apartment(1, 201), make_ranked_apartment(2, 202)],
        question="Can nay phu hop de o diem nao?",
        requested_model=None,
        history=[],
    )

    assert response.status == "failed"
    assert "json không hợp lệ" in response.error.lower()


def test_chat_about_apartment_refuses_obvious_out_of_scope_question(monkeypatch):
    monkeypatch.setattr(apartment_chat_openrouter_service.settings, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(apartment_chat_openrouter_service.settings, "OPENROUTER_DEFAULT_MODEL", "minimax/minimax-m2.5")

    response = apartment_chat_openrouter_service.chat_about_apartment(
        session_id=7,
        apartment=make_ranked_apartment(2, 202),
        weights=make_weights(),
        top_context=[make_ranked_apartment(1, 201), make_ranked_apartment(2, 202)],
        question="Hom nay gia vang bao nhieu?",
        requested_model=None,
        history=[],
    )

    assert response.status == "refused"
    assert response.refusal_reason
    assert response.suggested_questions


def test_chat_about_apartment_trims_history_before_call(monkeypatch):
    monkeypatch.setattr(apartment_chat_openrouter_service.settings, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(apartment_chat_openrouter_service.settings, "OPENROUTER_DEFAULT_MODEL", "minimax/minimax-m2.5")

    captured = {}

    def fake_post(*args, **kwargs):
        captured["json"] = kwargs["json"]
        return FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": '{"scope":"allowed","answer":"Can nay hop de o vi phap ly ro rang.","suggested_questions":["Can nay hop gia dinh nho khong?","Can kiem tra gi khi di xem?"]}'
                        }
                    }
                ]
            }
        )

    monkeypatch.setattr(apartment_chat_openrouter_service.requests, "post", fake_post)

    history = [
        ApartmentChatMessage(role="user" if index % 2 == 0 else "assistant", content=f"Tin nhan {index}")
        for index in range(8)
    ]
    response = apartment_chat_openrouter_service.chat_about_apartment(
        session_id=7,
        apartment=make_ranked_apartment(2, 202),
        weights=make_weights(),
        top_context=[make_ranked_apartment(1, 201), make_ranked_apartment(2, 202)],
        question="Can nay phu hop de o diem nao?",
        requested_model=None,
        history=history,
    )

    chat_history = captured["json"]["messages"][1]["content"]
    assert '"chat_history"' in chat_history
    assert "Tin nhan 0" not in chat_history
    assert "Tin nhan 7" in chat_history
    assert response.status == "success"
