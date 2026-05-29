import base64
import json
from typing import Any

from backend.clients.gemini import extract_generated_text, post_gemini
from backend.prompts.image_analysis import IMAGE_ANALYSIS_PROMPT


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


def analyze_product_image(
    image_bytes: bytes,
    media_type: str,
    api_key_override: str | None = None,
) -> dict[str, Any]:
    if not image_bytes:
        raise ValueError("Uploaded image is empty.")

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": IMAGE_ANALYSIS_PROMPT},
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

    response = (
        post_gemini(payload, image_analysis=True, api_key_override=api_key_override)
        if api_key_override
        else post_gemini(payload, image_analysis=True)
    )
    generated_text = extract_generated_text(response)
    return _normalize_image_analysis(_parse_json_object(generated_text))
