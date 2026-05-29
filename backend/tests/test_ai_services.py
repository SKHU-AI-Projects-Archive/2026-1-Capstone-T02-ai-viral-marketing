import pytest
import httpx

from backend.clients import gemini
from backend.clients.gemini import GeminiOutputTruncatedError, extract_generated_text
from backend.config import get_gemini_settings
from backend.services import generation, image_analysis


def gemini_text_response(text: str, finish_reason: str = "STOP"):
    return {
        "candidates": [
            {
                "finishReason": finish_reason,
                "content": {
                    "parts": [
                        {
                            "text": text,
                        }
                    ]
                },
            }
        ]
    }


def test_extract_generated_text_parses_gemini_response():
    data = gemini_text_response("  생성된 문구입니다.  ")

    assert extract_generated_text(data) == "생성된 문구입니다."


def test_extract_generated_text_raises_for_max_tokens():
    data = gemini_text_response("중간에 끊긴 문구", finish_reason="MAX_TOKENS")

    with pytest.raises(GeminiOutputTruncatedError):
        extract_generated_text(data)


def test_generate_marketing_text_retries_after_max_tokens(monkeypatch):
    calls = []

    def fake_post_gemini(payload, *, api_key_override=None):
        assert api_key_override is None
        calls.append(payload)
        if len(calls) < 3:
            return gemini_text_response("미완성", finish_reason="MAX_TOKENS")
        return gemini_text_response("재시도 후 완성된 문구")

    monkeypatch.setattr(generation, "post_gemini", fake_post_gemini)
    monkeypatch.setattr(generation, "query_similar_generation_examples", lambda **_kwargs: [])
    monkeypatch.setattr(generation, "store_generation_example", lambda **_kwargs: "example-id")

    result = generation.generate_marketing_text(
        name="텀블러",
        keywords=["보온", "가성비"],
        summary="보온성이 좋은 텀블러",
        tone="coupang_review",
    )

    assert result == "재시도 후 완성된 문구"
    assert [call["generationConfig"]["maxOutputTokens"] for call in calls] == [2048, 4096, 8192]


def test_generate_marketing_text_fails_after_repeated_max_tokens(monkeypatch):
    monkeypatch.setattr(generation, "post_gemini", lambda _payload: gemini_text_response("미완성", "MAX_TOKENS"))
    monkeypatch.setattr(generation, "query_similar_generation_examples", lambda **_kwargs: [])
    monkeypatch.setattr(generation, "store_generation_example", lambda **_kwargs: "example-id")

    with pytest.raises(ValueError, match="토큰 제한"):
        generation.generate_marketing_text(
            name="텀블러",
            keywords=["보온"],
            summary="보온성이 좋은 텀블러",
            tone="coupang_review",
        )


def test_generate_marketing_text_passes_api_key_override(monkeypatch):
    seen_overrides = []

    def fake_post_gemini(payload, *, api_key_override=None):
        seen_overrides.append(api_key_override)
        return gemini_text_response("개인 키로 생성된 문구")

    monkeypatch.setattr(generation, "post_gemini", fake_post_gemini)
    monkeypatch.setattr(generation, "query_similar_generation_examples", lambda **_kwargs: [])
    monkeypatch.setattr(generation, "store_generation_example", lambda **_kwargs: "example-id")

    result = generation.generate_marketing_text(
        name="텀블러",
        keywords=["보온"],
        summary="보온성이 좋은 텀블러",
        tone="coupang_review",
        api_key_override="user-gemini-key",
    )

    assert result == "개인 키로 생성된 문구"
    assert seen_overrides == ["user-gemini-key"]


def test_post_gemini_uses_api_key_override(monkeypatch):
    seen_headers = []

    def fake_post(url, *, headers, json, timeout):
        seen_headers.append(headers)
        return httpx.Response(200, json=gemini_text_response("응답"), request=httpx.Request("POST", url))

    get_gemini_settings.cache_clear()
    monkeypatch.setattr(gemini.httpx, "post", fake_post)

    try:
        gemini.post_gemini({"contents": []}, api_key_override="user-gemini-key")
    finally:
        get_gemini_settings.cache_clear()

    assert seen_headers == [
        {
            "Content-Type": "application/json",
            "x-goog-api-key": "user-gemini-key",
        }
    ]


def test_post_gemini_requires_api_key_override():
    get_gemini_settings.cache_clear()
    try:
        with pytest.raises(ValueError, match="override is required"):
            gemini.post_gemini({"contents": []})
    finally:
        get_gemini_settings.cache_clear()


def test_analyze_product_image_normalizes_json_response(monkeypatch):
    response_text = """```json
{
  "features": {
    "category": "텀블러",
    "colors": ["화이트", "", 7],
    "materials": ["스테인리스"],
    "style_keywords": ["미니멀"],
    "use_cases": ["사무실"],
    "target_audience": ["직장인"],
    "selling_points": ["보온"],
    "detected_text": ["HOT"],
    "uncertainties": [""]
  },
  "recommendedKeywords": ["텀블러", "화이트", "화이트", ""],
  "recommendedSummary": "화이트 스테인리스 텀블러"
}
```"""

    def fake_post_gemini(payload, *, image_analysis=False):
        assert image_analysis is True
        assert payload["contents"][0]["parts"][1]["inline_data"]["mime_type"] == "image/png"
        return gemini_text_response(response_text)

    monkeypatch.setattr(image_analysis, "post_gemini", fake_post_gemini)

    result = image_analysis.analyze_product_image(b"image-bytes", "image/png")

    assert result["recommendedKeywords"] == ["텀블러", "화이트"]
    assert result["recommendedSummary"] == "화이트 스테인리스 텀블러"
    assert result["features"]["colors"] == ["화이트"]
    assert result["features"]["uncertainties"] == []
