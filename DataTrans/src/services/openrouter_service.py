"""
openrouter_service.py - Generate structured apartment insights from OpenRouter.
"""
from __future__ import annotations

import json
from typing import Any

from ahp_contracts import CriterionScoreBreakdown, LlmAnalysis, LlmApartmentAnalysisItem
from database import settings
from schema import CriterionWeight, RankedCanHo
from services.openrouter_client import (
    extract_json_object,
    extract_message_content,
    post_with_fallback,
)

CRITERION_IDS = tuple(f"C{index}" for index in range(1, 9))


def analyze_ranked_apartments(
    ranked: list[RankedCanHo],
    weights: list[CriterionWeight],
    requested_model: str | None,
    enabled: bool = True,
) -> LlmAnalysis:
    model = (requested_model or settings.OPENROUTER_DEFAULT_MODEL or "").strip() or None
    top_candidates = ranked[:10]
    top_k = len(top_candidates)

    if not enabled:
        return _build_skipped_analysis(model, top_k, "Đã tắt phân tích LLM.")

    if top_k == 0:
        return _build_skipped_analysis(model, 0, "Không có căn hộ để phân tích bằng LLM.")

    if not settings.OPENROUTER_API_KEY:
        return _build_failed_analysis(model, top_k, "OPENROUTER_API_KEY chưa được cấu hình.")

    if not model:
        return _build_failed_analysis(model, top_k, "OPENROUTER_DEFAULT_MODEL chưa được cấu hình.")

    model, response, error = post_with_fallback(
        requested_model=requested_model,
        messages=_build_messages(top_candidates, weights),
        temperature=0.2,
    )
    if error or response is None:
        return _build_failed_analysis(model, top_k, error or "Không thể kết nối OpenRouter.")

    try:
        payload = response.json()
        content = extract_message_content(payload)
        parsed = extract_json_object(content)
        normalized = _normalize_payload(parsed, top_candidates)
    except (ValueError, KeyError, TypeError) as exc:
        return _build_failed_analysis(model, top_k, f"LLM trả JSON không hợp lệ: {exc}")

    return LlmAnalysis(
        status="success",
        model=model,
        top_k=top_k,
        summary=normalized["summary"],
        winner_reason=normalized["winner_reason"],
        tradeoffs=normalized["tradeoffs"],
        error=None,
        apartments=normalized["apartments"],
    )


def restore_llm_analysis(raw_output: Any, model: str | None, status: str | None, error: str | None) -> LlmAnalysis:
    if raw_output:
        try:
            return LlmAnalysis.model_validate(raw_output)
        except Exception:
            pass

    safe_status = status if status in {"success", "failed", "skipped"} else "skipped"
    return LlmAnalysis(
        status=safe_status,
        model=model,
        top_k=0,
        summary=None,
        winner_reason=None,
        tradeoffs=[],
        error=error,
        apartments=[],
    )


def _build_messages(ranked: list[RankedCanHo], weights: list[CriterionWeight]) -> list[dict[str, str]]:
    criteria = [
        {
            "id": weight.id,
            "name": weight.name,
            "weight": round(weight.weight, 4),
            "pct": round(weight.pct, 2),
        }
        for weight in weights
    ]
    listings = [_serialize_ranked_apartment(item) for item in ranked]
    schema_hint = {
        "summary": "string",
        "winner_reason": "string",
        "tradeoffs": ["string"],
        "apartments": [
            {
                "rank": 1,
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
        "You are a real-estate decision analyst. "
        "You must respond with strict JSON only, no markdown, no prose outside JSON. "
        "AHP ranking is the primary ranking. Your job is to explain and support that ranking, "
        "not replace it. Use only provided facts and keep claims conservative."
    )
    user_prompt = json.dumps(
        {
            "task": (
                "Analyze the top apartments that were already ranked by AHP. "
                "Return exactly one JSON object. Preserve each apartment rank and canho_id. "
                "Provide concise Vietnamese text for summary, winner_reason, verdict, strengths, risks, and tradeoffs. "
                "Criterion scores must use keys C1..C8 with numeric values from 0 to 100. "
                "llm_support_score must be 0..100. strengths and risks should have at most 3 items. "
                "tradeoffs should have 3 to 5 items."
            ),
            "criteria_priorities": criteria,
            "top_apartments": listings,
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


def _normalize_payload(raw_payload: dict[str, Any], ranked: list[RankedCanHo]) -> dict[str, Any]:
    if not isinstance(raw_payload, dict):
        raise ValueError("Payload LLM phải là object")

    apartments_payload = raw_payload.get("apartments")
    if not isinstance(apartments_payload, list):
        raise ValueError("apartments phải là mảng")

    raw_by_id = {}
    raw_by_rank = {}
    for item in apartments_payload:
        if not isinstance(item, dict):
            continue
        canho_id = item.get("canho_id")
        rank = item.get("rank")
        if isinstance(canho_id, int):
            raw_by_id[canho_id] = item
        if isinstance(rank, int):
            raw_by_rank[rank] = item

    normalized_items = []
    for ranked_item in ranked:
        raw_item = raw_by_id.get(ranked_item.canho.id) or raw_by_rank.get(ranked_item.rank) or {}
        normalized_items.append(_normalize_apartment_item(raw_item, ranked_item))

    return {
        "summary": _normalize_text(raw_payload.get("summary")),
        "winner_reason": _normalize_text(raw_payload.get("winner_reason")),
        "tradeoffs": _normalize_string_list(raw_payload.get("tradeoffs"), min_items=0, max_items=5),
        "apartments": normalized_items,
    }


def _normalize_apartment_item(raw_item: dict[str, Any], ranked_item: RankedCanHo) -> LlmApartmentAnalysisItem:
    verdict = _normalize_text(raw_item.get("verdict")) or "LLM chưa trả đủ nhận xét cho căn hộ này."
    strengths = _normalize_string_list(raw_item.get("strengths"), min_items=0, max_items=3)
    risks = _normalize_string_list(raw_item.get("risks"), min_items=0, max_items=3)
    criterion_scores = _normalize_criterion_scores(raw_item.get("criterion_scores"))

    support_score = raw_item.get("llm_support_score", 50)
    try:
        support_score = float(support_score)
    except (TypeError, ValueError):
        support_score = 50

    return LlmApartmentAnalysisItem(
        rank=ranked_item.rank,
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


def _normalize_string_list(value: Any, min_items: int, max_items: int) -> list[str]:
    if not isinstance(value, list):
        return []

    items = []
    for item in value:
        text = _normalize_text(item)
        if text:
            items.append(text)
        if len(items) >= max_items:
            break

    if len(items) < min_items:
        return items

    return items


def _build_failed_analysis(model: str | None, top_k: int, error: str) -> LlmAnalysis:
    return LlmAnalysis(
        status="failed",
        model=model,
        top_k=top_k,
        summary=None,
        winner_reason=None,
        tradeoffs=[],
        error=error,
        apartments=[],
    )


def _build_skipped_analysis(model: str | None, top_k: int, reason: str) -> LlmAnalysis:
    return LlmAnalysis(
        status="skipped",
        model=model,
        top_k=top_k,
        summary=None,
        winner_reason=None,
        tradeoffs=[],
        error=reason,
        apartments=[],
    )
