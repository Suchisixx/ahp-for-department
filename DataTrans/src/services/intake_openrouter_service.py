"""
Generate AHP intake guidance from natural-language housing needs.
"""
from __future__ import annotations

import json
from typing import Any

import requests

from ahp_contracts import AhpIntentProfile, AhpIntakeResponse
from database import settings
from schema import CriterionWeight
from services.ahp_engine import CRITERIA

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
CRITERION_IDS = tuple(criterion["id"] for criterion in CRITERIA)
PRESET_IDS = {"balanced", "price", "quality", "legal", "location"}


def generate_ahp_intake_guidance(
    user_input: str,
    requested_model: str | None,
) -> AhpIntakeResponse:
    model = (requested_model or settings.OPENROUTER_DEFAULT_MODEL or "").strip() or None

    if not settings.OPENROUTER_API_KEY:
        return _build_failed_response(model, "OPENROUTER_API_KEY chưa được cấu hình.")

    if not model:
        return _build_failed_response(model, "OPENROUTER_DEFAULT_MODEL chưa được cấu hình.")

    try:
        response = requests.post(
            OPENROUTER_URL,
            headers=_build_headers(),
            json={
                "model": model,
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
                "messages": _build_messages(user_input),
            },
            timeout=settings.OPENROUTER_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        return _build_failed_response(model, _format_exception(exc))

    if not response.ok:
        return _build_failed_response(model, _extract_http_error(response))

    try:
        payload = response.json()
        content = _extract_message_content(payload)
        parsed = _extract_json_object(content)
        normalized = _normalize_payload(parsed)
    except (ValueError, KeyError, TypeError) as exc:
        return _build_failed_response(model, f"AI trả JSON không hợp lệ: {exc}")

    return AhpIntakeResponse(
        status="success",
        model=model,
        intent_profile=normalized["intent_profile"],
        recommended_preset=normalized["recommended_preset"],
        suggested_weights=normalized["suggested_weights"],
        explanation=normalized["explanation"],
        error=None,
    )


def _build_headers() -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    if settings.OPENROUTER_SITE_URL:
        headers["HTTP-Referer"] = settings.OPENROUTER_SITE_URL
    if settings.OPENROUTER_APP_NAME:
        headers["X-Title"] = settings.OPENROUTER_APP_NAME

    return headers


def _build_messages(user_input: str) -> list[dict[str, str]]:
    criteria_guide = [
        {"id": criterion["id"], "name": criterion["name"]}
        for criterion in CRITERIA
    ]
    preset_guide = {
        "balanced": "Cân bằng nhiều yếu tố, không nghiêng quá mạnh về một phía.",
        "price": "Ưu tiên tài chính và mức giá phù hợp.",
        "quality": "Ưu tiên chất lượng sống, nội thất và cảm giác ở thực tế.",
        "legal": "Ưu tiên pháp lý rõ ràng và an tâm an cư.",
        "location": "Ưu tiên vị trí, sự thuận tiện đi lại và hạ tầng quanh nhà.",
    }
    schema_hint = {
        "intent_profile": {
            "goal": "string",
            "budget": "string or null",
            "preferred_area": "string or null",
            "bedroom_need": "string or null",
            "top_priorities": ["string"],
            "deal_breakers": ["string"],
        },
        "recommended_preset": "balanced|price|quality|legal|location",
        "priority_scores": {criterion_id: 1 for criterion_id in CRITERION_IDS},
        "explanation": "string",
    }

    system_prompt = (
        "You are an intake co-pilot for an apartment decision-support system that uses AHP. "
        "You help owner-occupiers describe what they need before ranking apartments. "
        "You must respond with strict JSON only, no markdown, no prose outside JSON. "
        "Do not discuss investment, rental yield, appreciation, speculation, or flipping. "
        "Use only the user's stated needs. Keep the explanation concise, practical, and friendly."
    )
    user_prompt = json.dumps(
        {
            "task": (
                "Read the user's housing needs written in Vietnamese and convert them into an AHP starting profile. "
                "Return exactly one JSON object. "
                "intent_profile should summarize what the user needs to live in the apartment. "
                "recommended_preset must be one of the provided preset ids. "
                "priority_scores must include all keys C1..C8 with numeric values from 1 to 9. "
                "Use moderate spreads only so the starting profile is editable by the user. "
                "top_priorities and deal_breakers should have at most 4 short items each. "
                "explanation must explain what the AI understood and how that became the suggested starting configuration. "
                "Focus on buying to live in, not investing."
            ),
            "criteria_guide": criteria_guide,
            "preset_guide": preset_guide,
            "user_input": user_input,
            "expected_json_schema": schema_hint,
        },
        ensure_ascii=False,
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _normalize_payload(raw_payload: dict[str, Any]) -> dict[str, Any]:
    if not isinstance(raw_payload, dict):
        raise ValueError("Payload intake phải là object")

    intent_profile = _normalize_intent_profile(raw_payload.get("intent_profile"))
    recommended_preset = _normalize_preset(raw_payload.get("recommended_preset"))
    priority_scores = _normalize_priority_scores(
        raw_payload.get("priority_scores") or raw_payload.get("suggested_weights")
    )
    suggested_weights = _build_suggested_weights(priority_scores)
    explanation = _normalize_text(raw_payload.get("explanation")) or _build_default_explanation(
        intent_profile,
        recommended_preset,
    )

    return {
        "intent_profile": intent_profile,
        "recommended_preset": recommended_preset,
        "suggested_weights": suggested_weights,
        "explanation": explanation,
    }


def _normalize_intent_profile(raw_profile: Any) -> AhpIntentProfile:
    if not isinstance(raw_profile, dict):
        raw_profile = {}

    return AhpIntentProfile(
        goal=_normalize_text(raw_profile.get("goal")) or "Đang tìm một căn hộ phù hợp để ở thực.",
        budget=_normalize_text(raw_profile.get("budget")),
        preferred_area=_normalize_text(raw_profile.get("preferred_area")),
        bedroom_need=_normalize_text(raw_profile.get("bedroom_need")),
        top_priorities=_normalize_text_list(raw_profile.get("top_priorities"), max_items=4),
        deal_breakers=_normalize_text_list(raw_profile.get("deal_breakers"), max_items=4),
    )


def _normalize_preset(value: Any) -> str:
    if not isinstance(value, str):
        return "balanced"

    preset = value.strip().lower()
    return preset if preset in PRESET_IDS else "balanced"


def _normalize_priority_scores(raw_scores: Any) -> dict[str, float]:
    raw_scores = raw_scores if isinstance(raw_scores, dict) else {}
    normalized = {}
    for criterion_id in CRITERION_IDS:
        value = raw_scores.get(criterion_id, 5)
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            numeric = 5
        normalized[criterion_id] = max(1.0, min(9.0, numeric))
    return normalized


def _build_suggested_weights(priority_scores: dict[str, float]) -> list[CriterionWeight]:
    total = sum(priority_scores.values()) or float(len(CRITERION_IDS))
    return [
        CriterionWeight(
            id=criterion["id"],
            name=criterion["name"],
            weight=round(priority_scores[criterion["id"]] / total, 4),
            pct=round(priority_scores[criterion["id"]] / total * 100, 2),
        )
        for criterion in CRITERIA
    ]


def _normalize_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None

    text = value.strip()
    return text or None


def _normalize_text_list(value: Any, max_items: int) -> list[str]:
    if not isinstance(value, list):
        return []

    normalized = []
    for item in value:
        text = _normalize_text(item)
        if text:
            normalized.append(text[:120])
        if len(normalized) >= max_items:
            break
    return normalized


def _build_default_explanation(intent_profile: AhpIntentProfile, recommended_preset: str) -> str:
    top_priority = intent_profile.top_priorities[0] if intent_profile.top_priorities else "nhu cầu ở thực"
    preset_copy = {
        "balanced": "bộ ưu tiên cân bằng",
        "price": "bộ ưu tiên nghiêng về tài chính",
        "quality": "bộ ưu tiên nghiêng về chất lượng sống",
        "legal": "bộ ưu tiên nghiêng về pháp lý",
        "location": "bộ ưu tiên nghiêng về vị trí và thuận tiện hằng ngày",
    }
    return (
        f"AI đang hiểu bạn ưu tiên {top_priority.lower()} nên đề xuất "
        f"{preset_copy.get(recommended_preset, 'bộ ưu tiên cân bằng')} "
        "làm điểm bắt đầu trước khi bạn chỉnh tay thêm."
    )


def _extract_http_error(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return f"OpenRouter lỗi HTTP {response.status_code}"

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            return error.get("message") or error.get("code") or f"OpenRouter lỗi HTTP {response.status_code}"
        if isinstance(error, str):
            return error

    return f"OpenRouter lỗi HTTP {response.status_code}"


def _extract_message_content(payload: dict[str, Any]) -> str:
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise ValueError("Không tìm thấy choices trong phản hồi OpenRouter")

    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    if not isinstance(message, dict):
        raise ValueError("Không tìm thấy message trong phản hồi OpenRouter")

    content = message.get("content")
    if isinstance(content, str):
        return content

    if isinstance(content, list):
        text_parts = []
        for part in content:
            if isinstance(part, dict) and part.get("type") == "text":
                text_parts.append(part.get("text", ""))
        if text_parts:
            return "\n".join(text_parts)

    raise ValueError("Không đọc được nội dung phản hồi từ OpenRouter")


def _extract_json_object(content: str) -> dict[str, Any]:
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.lower().startswith("json"):
            text = text[4:].strip()

    start = text.find("{")
    end = text.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("Không tìm thấy JSON object trong phản hồi")

    return json.loads(text[start : end + 1])


def _build_failed_response(model: str | None, error: str) -> AhpIntakeResponse:
    return AhpIntakeResponse(
        status="failed",
        model=model,
        intent_profile=None,
        recommended_preset="balanced",
        suggested_weights=[],
        explanation=None,
        error=error,
    )


def _format_exception(exc: requests.RequestException) -> str:
    if isinstance(exc, requests.Timeout):
        return "OpenRouter quá thời gian phản hồi."
    return str(exc) or "Không thể kết nối OpenRouter."
