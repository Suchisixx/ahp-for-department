"""
Generate apartment-only chat responses from OpenRouter.
"""
from __future__ import annotations

import json
import re
from typing import Any

from ahp_contracts import ApartmentChatMessage, ApartmentChatResponse
from database import settings
from schema import CriterionWeight, RankedCanHo
from services.openrouter_client import (
    extract_json_object,
    extract_message_content,
    post_with_fallback,
)

OUT_OF_SCOPE_PATTERN = re.compile(
    r"\b("
    r"giá vàng|vang|bitcoin|crypto|chứng khoán|co phieu|cổ phiếu|thời tiết|bóng đá|"
    r"python|javascript|lập trình|lap trinh|code|chính trị|benh|bệnh|thuốc|thuoc"
    r")\b",
    re.IGNORECASE,
)


def chat_about_apartment(
    session_id: int,
    apartment: RankedCanHo,
    weights: list[CriterionWeight],
    top_context: list[RankedCanHo],
    question: str,
    requested_model: str | None,
    history: list[ApartmentChatMessage],
) -> ApartmentChatResponse:
    model = (requested_model or settings.OPENROUTER_DEFAULT_MODEL or "").strip() or None
    suggestions = _default_suggested_questions(apartment)

    if _should_refuse_without_llm(question):
        return ApartmentChatResponse(
            status="refused",
            model=model,
            session_id=session_id,
            canho_id=apartment.canho.id,
            answer=None,
            suggested_questions=suggestions,
            refusal_reason=(
                "Mình chỉ hỗ trợ giải đáp về căn hộ đang xem, nhu cầu ở thực và những điểm cần kiểm tra khi đi xem nhà."
            ),
            error=None,
        )

    if not settings.OPENROUTER_API_KEY:
        return _build_failed_response(
            session_id=session_id,
            canho_id=apartment.canho.id,
            model=model,
            error="OPENROUTER_API_KEY chưa được cấu hình.",
            suggested_questions=suggestions,
        )

    if not model:
        return _build_failed_response(
            session_id=session_id,
            canho_id=apartment.canho.id,
            model=model,
            error="OPENROUTER_DEFAULT_MODEL chưa được cấu hình.",
            suggested_questions=suggestions,
        )

    model, response, error = post_with_fallback(
        requested_model=requested_model,
        messages=_build_messages(
            apartment=apartment,
            weights=weights,
            top_context=top_context,
            question=question,
            history=history,
        ),
        temperature=0.2,
    )
    if error or response is None:
        return _build_failed_response(
            session_id=session_id,
            canho_id=apartment.canho.id,
            model=model,
            error=error or "Không thể kết nối OpenRouter.",
            suggested_questions=suggestions,
        )

    try:
        payload = response.json()
        content = extract_message_content(payload)
        parsed = extract_json_object(content)
        normalized = _normalize_payload(parsed, apartment)
    except (ValueError, KeyError, TypeError) as exc:
        return _build_failed_response(
            session_id=session_id,
            canho_id=apartment.canho.id,
            model=model,
            error=f"AI trả JSON không hợp lệ: {exc}",
            suggested_questions=suggestions,
        )

    merged_suggestions = normalized["suggested_questions"] or suggestions
    if normalized["status"] == "refused":
        return ApartmentChatResponse(
            status="refused",
            model=model,
            session_id=session_id,
            canho_id=apartment.canho.id,
            answer=None,
            suggested_questions=merged_suggestions,
            refusal_reason=normalized["refusal_reason"],
            error=None,
        )

    return ApartmentChatResponse(
        status="success",
        model=model,
        session_id=session_id,
        canho_id=apartment.canho.id,
        answer=normalized["answer"],
        suggested_questions=merged_suggestions,
        refusal_reason=None,
        error=None,
    )


def _build_messages(
    apartment: RankedCanHo,
    weights: list[CriterionWeight],
    top_context: list[RankedCanHo],
    question: str,
    history: list[ApartmentChatMessage],
) -> list[dict[str, str]]:
    criteria = [
        {
            "id": weight.id,
            "name": weight.name,
            "weight": round(weight.weight, 4),
            "pct": round(weight.pct, 2),
        }
        for weight in weights
    ]
    schema_hint = {
        "scope": "allowed",
        "answer": "string",
        "refusal_reason": None,
        "suggested_questions": ["string"],
    }
    system_prompt = (
        "You are ApartmentBroker's apartment assistant. "
        "You only answer questions related to the currently selected apartment, owner-occupier decisions, "
        "AHP context, legal/facility facts already provided, and practical home-viewing checks. "
        "You must refuse every question outside apartment scope, including programming, medicine, politics, finance, weather, sports, or unrelated general knowledge. "
        "Use only the provided apartment data and safe generic advice about checking a home in practice. "
        "Never invent facts, prices, legal claims, amenities, or guarantees. "
        "If data is missing, say clearly that the system does not have enough data yet and suggest a narrower apartment-related question. "
        "Respond with strict JSON only, no markdown and no extra prose outside JSON. "
        "Keep Vietnamese answers concise, practical, and friendly."
    )
    user_prompt = json.dumps(
        {
            "task": (
                "Answer the user's apartment question using the current apartment context. "
                "Return exactly one JSON object. "
                "If the question is outside apartment scope, set scope='refused', leave answer null, and explain briefly in refusal_reason. "
                "If the question is within scope, set scope='allowed' and answer in 2 to 5 concise Vietnamese sentences. "
                "Always include 2 or 3 suggested_questions that stay within apartment scope."
            ),
            "current_apartment": _serialize_ranked_apartment(apartment),
            "criteria_priorities": criteria,
            "top_context": [_serialize_snapshot(item) for item in top_context[:3]],
            "chat_history": [
                {"role": item.role, "content": item.content}
                for item in history[-6:]
            ],
            "user_question": question,
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
        "title": canho.title,
        "project": canho.du_an,
        "location": canho.phuong,
        "ahp_score": round(item.ahp_score * 100, 2),
        "ahp_score_detail": item.score_detail,
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
        "source_url": canho.url,
    }


def _serialize_snapshot(item: RankedCanHo) -> dict[str, Any]:
    canho = item.canho
    return {
        "rank": item.rank,
        "canho_id": canho.id,
        "title": canho.title,
        "ahp_score": round(item.ahp_score * 100, 2),
        "price_billion_vnd": canho.gia_ty,
        "area_m2": canho.dien_tich,
        "bedrooms": canho.so_phong_ngu,
        "legal": canho.phap_ly,
    }


def _normalize_payload(raw_payload: dict[str, Any], apartment: RankedCanHo) -> dict[str, Any]:
    if not isinstance(raw_payload, dict):
        raise ValueError("Payload AI phải là object")

    scope = str(raw_payload.get("scope") or "").strip().lower()
    suggestions = _normalize_string_list(raw_payload.get("suggested_questions"), max_items=3)

    if scope == "refused":
        return {
            "status": "refused",
            "answer": None,
            "refusal_reason": (
                _normalize_text(raw_payload.get("refusal_reason"))
                or "Mình chỉ hỗ trợ các câu hỏi liên quan trực tiếp đến căn hộ này."
            ),
            "suggested_questions": suggestions or _default_suggested_questions(apartment),
        }

    return {
        "status": "success",
        "answer": (
            _normalize_text(raw_payload.get("answer"))
            or "Mình chưa có đủ dữ liệu trong hệ thống để trả lời rõ hơn về căn hộ này."
        ),
        "refusal_reason": None,
        "suggested_questions": suggestions or _default_suggested_questions(apartment),
    }


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
    canho_id: int,
    model: str | None,
    error: str,
    suggested_questions: list[str],
) -> ApartmentChatResponse:
    return ApartmentChatResponse(
        status="failed",
        model=model,
        session_id=session_id,
        canho_id=canho_id,
        answer=None,
        suggested_questions=suggested_questions,
        refusal_reason=None,
        error=error,
    )


def _default_suggested_questions(apartment: RankedCanHo) -> list[str]:
    name = (apartment.canho.du_an or apartment.canho.title or "căn này").strip()
    return [
        f"{name} phù hợp để ở ở điểm nào?",
        "Đi xem thực tế nên kiểm tra gì trước?",
        "Điểm cần cân nhắc của căn này là gì?",
    ]


def _should_refuse_without_llm(question: str) -> bool:
    return bool(OUT_OF_SCOPE_PATTERN.search(question or ""))
