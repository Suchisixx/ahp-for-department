from pathlib import Path
import sys

import requests

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from services import intake_openrouter_service


class FakeResponse:
    def __init__(self, payload, ok=True, status_code=200):
        self._payload = payload
        self.ok = ok
        self.status_code = status_code

    def json(self):
        return self._payload


def test_generate_ahp_intake_guidance_timeout_returns_failed(monkeypatch):
    monkeypatch.setattr(intake_openrouter_service.settings, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(intake_openrouter_service.settings, "OPENROUTER_DEFAULT_MODEL", "openai/gpt-4o-mini")

    def raise_timeout(*args, **kwargs):
        raise requests.Timeout("deadline")

    monkeypatch.setattr(intake_openrouter_service.requests, "post", raise_timeout)

    response = intake_openrouter_service.generate_ahp_intake_guidance(
        user_input="Mình mua để ở, ưu tiên pháp lý và cần 3 phòng ngủ.",
        requested_model=None,
    )

    assert response.status == "failed"
    assert "quá thời gian" in response.error.lower()


def test_generate_ahp_intake_guidance_invalid_json_returns_failed(monkeypatch):
    monkeypatch.setattr(intake_openrouter_service.settings, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(intake_openrouter_service.settings, "OPENROUTER_DEFAULT_MODEL", "openai/gpt-4o-mini")
    monkeypatch.setattr(
        intake_openrouter_service.requests,
        "post",
        lambda *args, **kwargs: FakeResponse({"choices": [{"message": {"content": "not-a-json"}}]}),
    )

    response = intake_openrouter_service.generate_ahp_intake_guidance(
        user_input="Mình mua để ở, ưu tiên pháp lý và cần 3 phòng ngủ.",
        requested_model=None,
    )

    assert response.status == "failed"
    assert "json không hợp lệ" in response.error.lower()


def test_generate_ahp_intake_guidance_normalizes_priority_scores(monkeypatch):
    monkeypatch.setattr(intake_openrouter_service.settings, "OPENROUTER_API_KEY", "test-key")
    monkeypatch.setattr(intake_openrouter_service.settings, "OPENROUTER_DEFAULT_MODEL", "openai/gpt-4o-mini")
    monkeypatch.setattr(
        intake_openrouter_service.requests,
        "post",
        lambda *args, **kwargs: FakeResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": """
                            {
                              "intent_profile": {
                                "goal": "Tìm căn hộ để ở cho gia đình nhỏ",
                                "budget": "Khoảng 3.5 tỷ",
                                "preferred_area": "Quận 7",
                                "bedroom_need": "3 phòng ngủ",
                                "top_priorities": ["Pháp lý", "Tiện ích", "Di chuyển"],
                                "deal_breakers": ["Pháp lý mơ hồ"]
                              },
                              "recommended_preset": "legal",
                              "priority_scores": {
                                "C1": 6,
                                "C2": 4,
                                "C3": 3,
                                "C4": 9,
                                "C5": 6,
                                "C6": 5,
                                "C7": 4,
                                "C8": 3
                              },
                              "explanation": "AI hiểu bạn cần một cấu hình nghiêng về an cư ổn định."
                            }
                            """
                        }
                    }
                ]
            }
        ),
    )

    response = intake_openrouter_service.generate_ahp_intake_guidance(
        user_input="Mình mua để ở, khoảng 3.5 tỷ, ưu tiên pháp lý rõ ràng, cần 3PN ở Quận 7.",
        requested_model=None,
    )

    assert response.status == "success"
    assert response.recommended_preset == "legal"
    assert response.intent_profile.goal == "Tìm căn hộ để ở cho gia đình nhỏ"
    assert len(response.suggested_weights) == 8
    assert round(sum(weight.weight for weight in response.suggested_weights), 4) == 1.0
    assert response.suggested_weights[3].weight > response.suggested_weights[2].weight
