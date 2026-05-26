import json
from typing import Any

from backend.clients.gemini import GeminiOutputTruncatedError, extract_generated_text, post_gemini
from backend.prompts.generation import TONE_BUILDERS
from backend.repositories.vector_examples import query_similar_generation_examples, store_generation_example


MAX_GENERATION_ATTEMPTS = 3
MAX_GENERATION_OUTPUT_TOKENS = 8192

TONE_GENERATION_CONFIG: dict[str, dict[str, Any]] = {
    "blog": {"maxOutputTokens": 8192, "temperature": 0.85},
    "coupang_review": {"maxOutputTokens": 2048, "temperature": 0.9},
    "community_comment": {"maxOutputTokens": 2048, "temperature": 0.95},
}

MAX_REFERENCE_TEXT_CHARS: dict[str, int] = {
    "blog": 1200,
    "coupang_review": 420,
    "community_comment": 260,
}


def _format_image_analysis_block(image_analysis: dict[str, Any] | None) -> str:
    if not image_analysis:
        return ""

    return "\n\nImage analysis context:\n" + json.dumps(image_analysis, ensure_ascii=False, indent=2)


def _generation_config_for_attempt(tone: str, attempt: int) -> dict[str, Any]:
    config = dict(TONE_GENERATION_CONFIG[tone])
    output_tokens = int(config.get("maxOutputTokens", MAX_GENERATION_OUTPUT_TOKENS))
    config["maxOutputTokens"] = min(output_tokens * (2**attempt), MAX_GENERATION_OUTPUT_TOKENS)
    return config


def _clip_reference_text(text: str, tone: str) -> str:
    normalized = text.strip()
    max_chars = MAX_REFERENCE_TEXT_CHARS.get(tone, 600)
    if len(normalized) <= max_chars:
        return normalized
    return f"{normalized[:max_chars].rstrip()}..."


def _format_example_block(name: str, keywords: list[str], summary: str, tone: str, user_id: str | None) -> str:
    similar_examples = query_similar_generation_examples(
        name=name,
        keywords=keywords,
        summary=summary,
        tone=tone,
        user_id=user_id,
        limit=3,
    )
    if not similar_examples:
        return ""

    formatted_examples = []
    for index, example in enumerate(similar_examples, start=1):
        formatted_examples.append(
            f"""Example {index}
- Product name: {example["name"]}
- Keywords: {", ".join(example["keywords"])}
- Summary: {example["summary"]}
- Generated text: {_clip_reference_text(example["generated_text"], tone)}"""
        )
    return "\n\nReference examples from previous successful generations:\n" + "\n\n".join(formatted_examples)


def generate_marketing_text(
    name: str,
    keywords: list[str],
    summary: str,
    image_analysis: dict[str, Any] | None = None,
    tone: str = "blog",
    user_id: str | None = None,
) -> str:
    builder = TONE_BUILDERS.get(tone)
    if builder is None:
        raise ValueError(f"Unsupported tone: {tone}")

    prompt = builder(
        name,
        keywords,
        summary,
        _format_image_analysis_block(image_analysis),
        _format_example_block(name=name, keywords=keywords, summary=summary, tone=tone, user_id=user_id),
    )

    generated_text = ""
    last_truncation_error: GeminiOutputTruncatedError | None = None
    for attempt in range(MAX_GENERATION_ATTEMPTS):
        payload = {
            "contents": [
                {
                    "parts": [
                        {
                            "text": prompt,
                        }
                    ]
                }
            ],
            "generationConfig": _generation_config_for_attempt(tone, attempt),
        }

        try:
            generated_text = extract_generated_text(post_gemini(payload))
            break
        except GeminiOutputTruncatedError as exc:
            last_truncation_error = exc
    else:
        raise ValueError("AI 응답이 토큰 제한으로 중간에 끊겼습니다. 다시 시도해 주세요.") from last_truncation_error

    store_generation_example(
        name=name,
        keywords=keywords,
        summary=summary,
        generated_text=generated_text,
        tone=tone,
        user_id=user_id,
    )

    return generated_text
