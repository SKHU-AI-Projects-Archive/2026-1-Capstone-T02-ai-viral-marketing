from backend.services import image_analysis


def gemini_text_response(text: str):
    return {
        "candidates": [
            {
                "finishReason": "STOP",
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


def test_analyze_product_image_passes_api_key_override(monkeypatch):
    seen_overrides = []

    def fake_post_gemini(payload, *, image_analysis=False, api_key_override=None):
        assert image_analysis is True
        seen_overrides.append(api_key_override)
        return gemini_text_response(
            """{
  "features": {
    "category": "텀블러"
  },
  "recommendedKeywords": ["텀블러"],
  "recommendedSummary": "개인 키로 분석된 이미지"
}"""
        )

    monkeypatch.setattr(image_analysis, "post_gemini", fake_post_gemini)

    result = image_analysis.analyze_product_image(
        b"image-bytes",
        "image/png",
        api_key_override="user-gemini-key",
    )

    assert result["recommendedSummary"] == "개인 키로 분석된 이미지"
    assert seen_overrides == ["user-gemini-key"]
