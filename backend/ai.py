import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

from backend.vector_store import query_similar_examples, store_generated_example


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env", override=True)


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


def generate_marketing_text(name: str, keywords: list[str], summary: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY")
    model = _normalize_model_name(os.getenv("GEMINI_MODEL", "gemini-2.5-flash"))
    timeout_seconds = float(os.getenv("GEMINI_TIMEOUT_SECONDS", "8"))
    if not api_key:
        raise ValueError("GEMINI_API_KEY environment variable is not set.")

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
{example_block}

Requirements:
- Avoid exaggerated advertising language
- Make it sound like a brief real-user impression
- Use no more than 3 sentences
- Write the output in Korean"""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
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
        data = response.json()
    except httpx.TimeoutException as exc:
        raise ValueError(
            "Gemini request timed out. Check network access or increase GEMINI_TIMEOUT_SECONDS."
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

    try:
        parts = data["candidates"][0]["content"]["parts"]
        generated_text = "".join(part.get("text", "") for part in parts).strip()
    except (KeyError, IndexError, TypeError) as exc:
        raise ValueError("Gemini response format was unexpected.") from exc

    if not generated_text:
        raise ValueError("Gemini returned an empty response.")

    store_generated_example(
        name=name,
        keywords=keywords,
        summary=summary,
        generated_text=generated_text,
    )

    return generated_text
