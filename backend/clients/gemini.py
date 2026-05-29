from typing import Any

import httpx

from backend.config import get_gemini_settings


class GeminiOutputTruncatedError(ValueError):
    pass


def _extract_error_message(response: httpx.Response) -> str:
    try:
        data = response.json()
    except ValueError:
        text = response.text.strip()
        return text or response.reason_phrase

    error = data.get("error")
    if isinstance(error, dict):
        message = error.get("message")
        status = error.get("status")
        if message and status:
            return f"{status}: {message}"
        if message:
            return str(message)

    return response.reason_phrase or "Unknown Gemini API error."


def post_gemini(
    payload: dict[str, Any],
    *,
    image_analysis: bool = False,
    api_key_override: str | None = None,
) -> dict[str, Any]:
    settings = get_gemini_settings()
    timeout_seconds = settings.image_timeout_seconds if image_analysis else settings.generate_timeout_seconds
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{settings.model}:generateContent"
    api_key = (api_key_override or "").strip()
    if not api_key:
        raise ValueError("Gemini API key override is required.")

    try:
        response = httpx.post(
            url,
            headers={
                "Content-Type": "application/json",
                "x-goog-api-key": api_key,
            },
            json=payload,
            timeout=timeout_seconds,
        )
        response.raise_for_status()
        return response.json()
    except httpx.TimeoutException as exc:
        timeout_env_hint = "GEMINI_IMAGE_TIMEOUT_SECONDS" if image_analysis else "GEMINI_GENERATE_TIMEOUT_SECONDS"
        raise ValueError(
            f"Gemini request timed out. Check network access or increase {timeout_env_hint}."
        ) from exc
    except httpx.ConnectError as exc:
        raise ValueError("Failed to connect to Gemini API. Check network/proxy settings.") from exc
    except httpx.HTTPStatusError as exc:
        response = exc.response
        status_code = response.status_code
        error_message = _extract_error_message(response)
        if status_code in (401, 403):
            raise ValueError(
                f"Gemini authentication failed. Verify the user's Gemini API key. Provider said: {error_message}"
            ) from exc
        if status_code == 429:
            raise ValueError(
                f"Gemini quota exceeded or rate-limited. Provider said: {error_message}"
            ) from exc
        if status_code == 405:
            raise ValueError(
                "Gemini rejected the request method or endpoint. "
                f"Check GEMINI_MODEL and API compatibility. Provider said: {error_message}"
            ) from exc
        raise ValueError(f"Gemini API error: status={status_code}. Provider said: {error_message}") from exc


def extract_generated_text(data: dict[str, Any]) -> str:
    try:
        candidate = data["candidates"][0]
        parts = candidate["content"]["parts"]
        generated_text = "".join(part.get("text", "") for part in parts).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Gemini response format was unexpected.") from exc

    finish_reason = str(candidate.get("finishReason", "")).upper()
    if finish_reason == "MAX_TOKENS":
        raise GeminiOutputTruncatedError("Gemini stopped before finishing the response.")

    if not generated_text:
        raise ValueError("Gemini returned an empty response.")
    return generated_text
