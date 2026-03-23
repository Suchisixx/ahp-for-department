"""
Generate structured apartment comparison insights from OpenRouter.
"""
from __future__ import annotations

import json
from typing import Any

import requests

from ahp_contracts import (
    CompareApartmentAnalysisItem,
    CompareResponse,
    CriterionScoreBreakdown,
)
from database import settings
from schema import CriterionWeight, RankedCanHo

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
CRITERION_IDS = tuple(f"C{index}" for index in range(1, 9))


def analyze_compared_apartments(
    session_id: int,
    apartments: list[RankedCanHo],
    weights: list[CriterionWeight],
    requested_model: str | None,
) -> CompareResponse:
    model = (requested_model or settings.OPENROUTER_DEFAULT_MODEL or "").strip() or None
    compared_ids = [item.canho.id for item in apartments]

    if not settings.OPENROUTER_API_KEY:
        return _build_failed_response(
            session_id=session_id,
            compared_ids=compared_ids,
            model=model,
            error="OPENROUTER_API_KEY chưa được cấu hình.",
        )

    if not model:
        return _build_failed_response(
            session_id=session_id,
            compared_ids=compared_ids,
            model=model,
            error="OPENROUTER_DEFAULT_MODEL chưa được cấu hình.",
        )

    try:
        response = requests.post(
            OPENROUTER_URL,
            headers=_build_headers(),
            json={
                "model": model,
                "temperature": 0.2,
                "response_format": {"type": "json_object"},
                "messages": _build_messages(apartments, weights),
            },
            timeout=settings.OPENROUTER_TIMEOUT_SECONDS,
        )
    except requests.RequestException as exc:
        return _build_failed_response(
            session_id=session_id,
            compared_ids=compared_ids,
            model=model,
            error=_format_exception(exc),
        )

    if not response.ok:
        return _build_failed_response(
            session_id=session_id,
            compared_ids=compared_ids,
            model=model,
            error=_extract_http_error(response),
        )

    try:
        payload = response.json()
        content = _extract_message_content(payload)
        parsed = _extract_json_object(content)
        normalized = _normalize_payload(parsed, apartments)
    except (ValueError, KeyError, TypeError) as exc:
        return _build_failed_response(
            session_id=session_id,
            compared_ids=compared_ids,
            model=model,
            error=f"LLM trả JSON không hợp lệ: {exc}",
        )

    return CompareResponse(
        status="success",
        model=model,
        session_id=session_id,
        compared_ids=compared_ids,
        summary=normalized["summary"],
        winner_id=normalized["winner_id"],
        winner_reason=normalized["winner_reason"],
        tradeoffs=normalized["tradeoffs"],
        apartments=normalized["apartments"],
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


def _build_messages(apartments: list[RankedCanHo], weights: list[CriterionWeight]) -> list[dict[str, str]]:
    criteria = [
        {
            "id": weight.id,
            "name": weight.name,
            "weight": round(weight.weight, 4),
            "pct": round(weight.pct, 2),
        }
        for weight in weights
    ]
    listings = [_serialize_ranked_apartment(item) for item in apartments]
    schema_hint = {
        "summary": "string",
        "winner_id": 123,
        "winner_reason": "string",
        "tradeoffs": ["string"],
        "apartments": [
            {
                "canho_id": 123,
                "llm_support_score": 82,
                "verdict": "string",
                "strengths": ["string"],
                "risks": ["string"],
                "criterion_scores": {criterion_id: 0 for criterion_id in CRITERION_IDS},
            }
        ],
    }

    system_prompt = (
        "You are a residential real-estate advisor focused only on owner-occupier decisions. "
        "You must respond with strict JSON only, no markdown, no prose outside JSON. "
        "Use only provided facts and keep claims conservative. "
        "Judge apartments only for liveability and suitability to stay in, not for investing. "
        "Do not discuss appreciation, speculation, rental yield, liquidity, resale upside, or investment potential. "
        "AHP ranking is the baseline ordering, and your job is to explain which option is better to live in, why, and what practical tradeoffs matter in daily life."
    )
    user_prompt = json.dumps(
        {
            "task": (
                "Compare the selected apartments and return exactly one JSON object. "
                "Write concise Vietnamese text for summary, winner_reason, verdict, strengths, risks, and tradeoffs. "
                "Choose winner_id from the provided canho_id values only. "
                "Criterion scores must use keys C1..C8 with numeric values from 0 to 100. "
                "llm_support_score must be 0..100. strengths and risks should have at most 3 items. "
                "tradeoffs should have 3 to 5 items. "
                "Focus strictly on buying to live in, not investing. "
                "Prioritize legal clarity for long-term stay, layout comfort, suitability for family life, internal amenities, surrounding social infrastructure, daily convenience, and the balance between price and quality of life. "
                "winner_reason must answer which apartment is better to live in and why. "
                "tradeoffs must be practical stay-or-live considerations, not investment commentary. "
                "Do not mention price appreciation, rental income, speculation, return on investment, or financial upside."
            ),
            "criteria_priorities": criteria,
            "selected_apartments": listings,
            "expected_json_schema": schema_hint,
        },
        ensure_ascii=False,
    )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def _serialize_ranked_apartment(item: RankedCanHo) -> dict[str, Any]:
    canho = item.canho
    return {
        "rank": item.rank,
        "canho_id": canho.id,
        "ahp_score": round(item.ahp_score * 100, 2),
        "ahp_score_detail": item.score_detail,
        "title": canho.title,
        "project": canho.du_an,
        "location": canho.phuong,
        "price_billion_vnd": canho.gia_ty,
        "price_million_per_m2": canho.gia_per_m2,
        "area_m2": canho.dien_tich,
        "bedrooms": canho.so_phong_ngu,
        "bathrooms": canho.so_phong_wc,
        "furniture": canho.noi_that,
        "legal": canho.phap_ly,
        "social_infrastructure": canho.tien_ich_ha_tang,
        "internal_amenities": canho.tien_ich_noi_khu,
        "home_orientation": canho.huong_nha,
        "balcony_orientation": canho.huong_ban_cong,
    }


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


def _normalize_payload(raw_payload: dict[str, Any], apartments: list[RankedCanHo]) -> dict[str, Any]:
    if not isinstance(raw_payload, dict):
        raise ValueError("Payload LLM phải là object")

    apartments_payload = raw_payload.get("apartments")
    if not isinstance(apartments_payload, list):
        raise ValueError("apartments phải là mảng")

    raw_by_id = {}
    for item in apartments_payload:
        if isinstance(item, dict) and isinstance(item.get("canho_id"), int):
            raw_by_id[item["canho_id"]] = item

    normalized_items = []
    valid_ids = {item.canho.id for item in apartments}
    for ranked_item in apartments:
        normalized_items.append(
            _normalize_apartment_item(raw_by_id.get(ranked_item.canho.id) or {}, ranked_item),
        )

    winner_id = raw_payload.get("winner_id")
    if not isinstance(winner_id, int) or winner_id not in valid_ids:
        winner_id = apartments[0].canho.id if apartments else None

    return {
        "summary": _normalize_text(raw_payload.get("summary")),
        "winner_id": winner_id,
        "winner_reason": _normalize_text(raw_payload.get("winner_reason")),
        "tradeoffs": _normalize_string_list(raw_payload.get("tradeoffs"), max_items=5),
        "apartments": normalized_items,
    }


def _normalize_apartment_item(
    raw_item: dict[str, Any],
    ranked_item: RankedCanHo,
) -> CompareApartmentAnalysisItem:
    verdict = _normalize_text(raw_item.get("verdict")) or "Hiện AI chưa có đủ dữ liệu để nhận xét rõ hơn về căn hộ này."
    strengths = _normalize_string_list(raw_item.get("strengths"), max_items=3)
    risks = _normalize_string_list(raw_item.get("risks"), max_items=3)
    criterion_scores = _normalize_criterion_scores(raw_item.get("criterion_scores"))

    support_score = raw_item.get("llm_support_score", 50)
    try:
        support_score = float(support_score)
    except (TypeError, ValueError):
        support_score = 50

    return CompareApartmentAnalysisItem(
        canho_id=ranked_item.canho.id,
        llm_support_score=max(0, min(100, support_score)),
        verdict=verdict,
        strengths=strengths,
        risks=risks,
        criterion_scores=criterion_scores,
    )


def _normalize_criterion_scores(raw_scores: Any) -> CriterionScoreBreakdown:
    normalized = {}
    raw_scores = raw_scores if isinstance(raw_scores, dict) else {}

    for criterion_id in CRITERION_IDS:
        value = raw_scores.get(criterion_id, 50)
        try:
            numeric = float(value)
        except (TypeError, ValueError):
            numeric = 50
        normalized[criterion_id] = max(0, min(100, numeric))

    return CriterionScoreBreakdown(**normalized)


def _normalize_text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None

    text = value.strip()
    return text or None


def _normalize_string_list(value: Any, max_items: int) -> list[str]:
    if not isinstance(value, list):
        return []

    items = []
    for item in value:
        text = _normalize_text(item)
        if text:
            items.append(text)
        if len(items) >= max_items:
            break

    return items


def _build_failed_response(
    session_id: int,
    compared_ids: list[int],
    model: str | None,
    error: str,
) -> CompareResponse:
    return CompareResponse(
        status="failed",
        model=model,
        session_id=session_id,
        compared_ids=compared_ids,
        summary=None,
        winner_id=None,
        winner_reason=None,
        tradeoffs=[],
        apartments=[],
        error=error,
    )


def _format_exception(exc: requests.RequestException) -> str:
    if isinstance(exc, requests.Timeout):
        return "OpenRouter quá thời gian phản hồi."
    return str(exc) or "Không thể kết nối OpenRouter."
