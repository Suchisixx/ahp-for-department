from pathlib import Path
import sys

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from ahp_contracts import CriterionScoreBreakdown, CompareApartmentAnalysisItem, CompareResponse
from schema import CanHoOut, CriterionWeight, RankedCanHo
from services import compare_openrouter_service


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


def test_analyze_compared_apartments_timeout_returns_failed(monkeypatch):
    monkeypatch.setattr(compare_openrouter_service.settings, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(compare_openrouter_service.settings, "OPENROUTER_DEFAULT_MODEL", "openai/gpt-4o-mini")

    def raise_timeout(*args, **kwargs):
        raise requests.Timeout("deadline")

    monkeypatch.setattr(compare_openrouter_service.requests, "post", raise_timeout)

    analysis = compare_openrouter_service.analyze_compared_apartments(
        session_id=12,
        apartments=[make_ranked_apartment(1, 101), make_ranked_apartment(2, 102)],
        weights=make_weights(),
        requested_model=None,
    )

    assert analysis.status == "failed"
    assert analysis.session_id == 12
    assert analysis.compared_ids == [101, 102]
    assert "quá thời gian" in analysis.error.lower()


def test_analyze_compared_apartments_invalid_json_returns_failed(monkeypatch):
    monkeypatch.setattr(compare_openrouter_service.settings, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(compare_openrouter_service.settings, "OPENROUTER_DEFAULT_MODEL", "openai/gpt-4o-mini")
    monkeypatch.setattr(
        compare_openrouter_service.requests,
        "post",
        lambda *args, **kwargs: FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": "not-a-json-payload",
                        }
                    }
                ]
            }
        ),
    )

    analysis = compare_openrouter_service.analyze_compared_apartments(
        session_id=12,
        apartments=[make_ranked_apartment(1, 101), make_ranked_apartment(2, 102)],
        weights=make_weights(),
        requested_model=None,
    )

    assert analysis.status == "failed"
    assert analysis.compared_ids == [101, 102]
    assert "json không hợp lệ" in analysis.error.lower()
