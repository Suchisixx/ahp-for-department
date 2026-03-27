from __future__ import annotations

from typing import Any

import requests

from database import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
FALLBACKABLE_ERROR_MARKERS = (
    "rate-limited",
    "rate limited",
    "temporarily",
    "overloaded",
    "capacity",
    "unavailable",
    "timeout",
    "timed out",
)


def resolve_model_candidates(requested_model: str | None) -> list[str]:
    candidates: list[str] = []
    configured = [
        requested_model,
        settings.OPENROUTER_DEFAULT_MODEL,
        *settings.OPENROUTER_FALLBACK_MODELS.split(","),
    ]

    for value in configured:
        model = (value or "").strip()
        if model and model not in candidates:
            candidates.append(model)

    return candidates


def build_headers() -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
    }

    if settings.OPENROUTER_SITE_URL:
        headers["HTTP-Referer"] = settings.OPENROUTER_SITE_URL
    if settings.OPENROUTER_APP_NAME:
        headers["X-Title"] = settings.OPENROUTER_APP_NAME

    return headers


def post_with_fallback(
    *,
    requested_model: str | None,
    messages: list[dict[str, str]],
    temperature: float,
) -> tuple[str | None, requests.Response | None, str | None]:
    candidates = resolve_model_candidates(requested_model)
    if not candidates:
        return None, None, "OPENROUTER_DEFAULT_MODEL chưa được cấu hình."

    errors: list[str] = []
    for model in candidates:
        try:
            response = requests.post(
                OPENROUTER_URL,
                headers=build_headers(),
                json={
                    "model": model,
                    "temperature": temperature,
                    "messages": messages,
                },
                timeout=settings.OPENROUTER_TIMEOUT_SECONDS,
            )
        except requests.RequestException as exc:
            error = format_exception(exc)
            errors.append(f"{model}: {error}")
            if _is_fallbackable_exception(exc):
                continue
            return model, None, error

        if response.ok:
            return model, response, None

        error = extract_http_error(response)
        errors.append(f"{model}: {error}")
        if _should_try_next_model(response.status_code, error):
            continue
        return model, None, error

    return candidates[0], None, _summarize_fallback_error(errors)


def extract_http_error(response: requests.Response) -> str:
    try:
        payload = response.json()
    except ValueError:
        return f"OpenRouter lỗi HTTP {response.status_code}"

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            metadata = error.get("metadata")
            if isinstance(metadata, dict) and isinstance(metadata.get("raw"), str):
                return metadata["raw"]
            return error.get("message") or error.get("code") or f"OpenRouter lỗi HTTP {response.status_code}"
        if isinstance(error, str):
            return error

    return f"OpenRouter lỗi HTTP {response.status_code}"


def extract_message_content(payload: dict[str, Any]) -> str:
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


def extract_json_object(content: str) -> dict[str, Any]:
    import json

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


def format_exception(exc: requests.RequestException) -> str:
    if isinstance(exc, requests.Timeout):
        return "OpenRouter quá thời gian phản hồi."
    return str(exc) or "Không thể kết nối OpenRouter."


def _is_fallbackable_exception(exc: requests.RequestException) -> bool:
    return isinstance(exc, (requests.Timeout, requests.ConnectionError))


def _should_try_next_model(status_code: int, error: str) -> bool:
    if status_code in {408, 409, 429, 500, 502, 503, 504}:
        return True

    normalized = error.lower()
    return any(marker in normalized for marker in FALLBACKABLE_ERROR_MARKERS)


def _summarize_fallback_error(errors: list[str]) -> str:
    if not errors:
        return "Không thể kết nối OpenRouter."
    return "Tất cả model fallback đều đang lỗi hoặc quá tải: " + " | ".join(errors[:5])
