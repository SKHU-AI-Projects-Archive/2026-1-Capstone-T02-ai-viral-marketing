import base64
import json
import os
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

from backend.vector_store import query_similar_examples, store_generated_example


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env", override=True)
DEFAULT_GEMINI_TIMEOUT_SECONDS = 110.0
MIN_GENERATE_TIMEOUT_SECONDS = 15.0
MIN_IMAGE_ANALYSIS_TIMEOUT_SECONDS = 30.0


def _normalize_model_name(model: str) -> str:
    normalized = model.strip()
    if not normalized:
        raise ValueError("GEMINI_MODEL environment variable is empty.")
    if normalized.startswith("models/"):
        normalized = normalized[len("models/") :]
    return normalized


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


def _get_env_float(name: str, default: float) -> float:
    raw_value = os.getenv(name)
    if raw_value is None:
        return default
    return float(raw_value)


def _get_gemini_config() -> tuple[str, str]:
    api_key = os.getenv("GEMINI_API_KEY")
    model = _normalize_model_name(os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")
    return api_key, model


def _get_gemini_timeout_seconds(*, image_analysis: bool = False) -> float:
    base_timeout = _get_env_float("GEMINI_TIMEOUT_SECONDS", DEFAULT_GEMINI_TIMEOUT_SECONDS)
    if image_analysis:
        image_timeout = _get_env_float("GEMINI_IMAGE_TIMEOUT_SECONDS", base_timeout)
        return max(image_timeout, MIN_IMAGE_ANALYSIS_TIMEOUT_SECONDS)

    generate_timeout = _get_env_float("GEMINI_GENERATE_TIMEOUT_SECONDS", base_timeout)
    return max(generate_timeout, MIN_GENERATE_TIMEOUT_SECONDS)


def _post_gemini(payload: dict[str, Any], *, image_analysis: bool = False) -> dict[str, Any]:
    api_key, model = _get_gemini_config()
    timeout_seconds = _get_gemini_timeout_seconds(image_analysis=image_analysis)
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

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
                f"Gemini authentication failed. Verify GEMINI_API_KEY. Provider said: {error_message}"
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


def _extract_generated_text(data: dict[str, Any]) -> str:
    try:
        parts = data["candidates"][0]["content"]["parts"]
        generated_text = "".join(part.get("text", "") for part in parts).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Gemini response format was unexpected.") from exc

    if not generated_text:
        raise ValueError("Gemini returned an empty response.")
    return generated_text


def _parse_json_object(text: str) -> dict[str, Any]:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()

    try:
        parsed = json.loads(cleaned)
    except json.JSONDecodeError as exc:
        raise ValueError("Gemini image analysis response was not valid JSON.") from exc
    if not isinstance(parsed, dict):
        raise ValueError("Gemini image analysis response must be a JSON object.")
    return parsed


def _as_string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item.strip() for item in value if isinstance(item, str) and item.strip()]


def _normalize_image_analysis(data: dict[str, Any]) -> dict[str, Any]:
    features = data.get("features")
    if not isinstance(features, dict):
        features = data

    normalized_features = {
        "category": str(features.get("category", "")).strip() if features.get("category") else "",
        "colors": _as_string_list(features.get("colors")),
        "materials": _as_string_list(features.get("materials")),
        "style_keywords": _as_string_list(features.get("style_keywords")),
        "use_cases": _as_string_list(features.get("use_cases")),
        "target_audience": _as_string_list(features.get("target_audience")),
        "selling_points": _as_string_list(features.get("selling_points")),
        "detected_text": _as_string_list(features.get("detected_text")),
        "uncertainties": _as_string_list(features.get("uncertainties")),
    }

    recommended_keywords = _as_string_list(data.get("recommendedKeywords"))
    if not recommended_keywords:
        recommended_keywords = [
            keyword
            for keyword in [
                normalized_features["category"],
                *normalized_features["colors"],
                *normalized_features["materials"],
                *normalized_features["style_keywords"],
                *normalized_features["use_cases"],
                *normalized_features["selling_points"],
            ]
            if keyword
        ]

    deduped_keywords = list(dict.fromkeys(recommended_keywords))[:12]
    recommended_summary = str(data.get("recommendedSummary", "")).strip()
    if not recommended_summary:
        summary_parts = [
            normalized_features["category"],
            ", ".join(normalized_features["colors"]),
            ", ".join(normalized_features["style_keywords"] or normalized_features["selling_points"]),
        ]
        recommended_summary = " / ".join(part for part in summary_parts if part)

    return {
        "recommendedKeywords": deduped_keywords,
        "recommendedSummary": recommended_summary,
        "features": normalized_features,
    }


def _format_image_analysis_block(image_analysis: dict[str, Any] | None) -> str:
    if not image_analysis:
        return ""

    return "\n\nImage analysis context:\n" + json.dumps(image_analysis, ensure_ascii=False, indent=2)


def analyze_product_image(image_bytes: bytes, media_type: str) -> dict[str, Any]:
    if not image_bytes:
        raise ValueError("Uploaded image is empty.")

    prompt = """Analyze the product image to help generate Korean marketing copy.
Extract only structured features visible in the image.
Do not guess invisible performance, materials, specifications, brand claims, or usage results.
Put uncertain or unverifiable information in uncertainties.
Return JSON only, with this exact shape:
{
  "features": {
    "category": "",
    "colors": [],
    "materials": [],
    "style_keywords": [],
    "use_cases": [],
    "target_audience": [],
    "selling_points": [],
    "detected_text": [],
    "uncertainties": []
  },
  "recommendedKeywords": [],
  "recommendedSummary": ""
}"""

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": prompt},
                    {
                        "inline_data": {
                            "mime_type": media_type,
                            "data": base64.b64encode(image_bytes).decode("ascii"),
                        }
                    },
                ]
            }
        ],
        "generationConfig": {
            "response_mime_type": "application/json",
        },
    }

    generated_text = _extract_generated_text(_post_gemini(payload, image_analysis=True))
    return _normalize_image_analysis(_parse_json_object(generated_text))


def generate_marketing_text(
    name: str,
    keywords: list[str],
    summary: str,
    image_analysis: dict[str, Any] | None = None,
) -> str:
    similar_examples = query_similar_examples(name=name, keywords=keywords, summary=summary, limit=3)
    example_block = ""
    if similar_examples:
        formatted_examples = []
        for index, example in enumerate(similar_examples, start=1):
            formatted_examples.append(
                f"""Example {index}
- Product name: {example["name"]}
- Keywords: {", ".join(example["keywords"])}
- Summary: {example["summary"]}
- Generated text: {example["generated_text"]}"""
            )
        example_block = "\n\nReference examples from previous successful generations:\n" + "\n\n".join(
            formatted_examples
        )

    prompt = f"""Write short marketing copy for the product below.
The tone should feel like a natural online community review, not an ad.

Product name: {name}
Keywords: {", ".join(keywords)}
Summary: {summary}
{_format_image_analysis_block(image_analysis)}
{example_block}

Requirements:
- Avoid exaggerated advertising language
- Make it sound like a brief real-user impression
- Reflect image analysis context only when it is relevant and do not invent unverifiable details
- Use no more than 3 sentences
- Write the output in Korean"""

    payload = {
        "contents": [
            {
                "parts": [
                    {
                        "text": prompt,
                    }
                ]
            }
        ]
    }

    generated_text = _extract_generated_text(_post_gemini(payload))

    store_generated_example(
        name=name,
        keywords=keywords,
        summary=summary,
        generated_text=generated_text,
    )

    return generated_text
