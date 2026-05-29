from fastapi.testclient import TestClient

from backend import main


INTERNAL_HEADERS = {"X-Internal-API-Secret": "development-internal-api-secret"}


def test_internal_generate_passes_gemini_api_key_override(monkeypatch):
    seen_kwargs = {}

    def fake_generate_marketing_text(**kwargs):
        seen_kwargs.update(kwargs)
        return "생성된 문구"

    monkeypatch.setattr(main, "generate_marketing_text", fake_generate_marketing_text)
    client = TestClient(main.app)

    response = client.post(
        "/internal/generate",
        headers=INTERNAL_HEADERS,
        json={
            "name": "텀블러",
            "keywords": ["보온"],
            "summary": "보온성이 좋은 텀블러",
            "tone": "blog",
            "geminiApiKeyOverride": "user-gemini-key",
        },
    )

    assert response.status_code == 200
    assert response.json() == {"generated_text": "생성된 문구"}
    assert seen_kwargs["api_key_override"] == "user-gemini-key"


def test_internal_analyze_image_passes_gemini_api_key_override(monkeypatch):
    seen_kwargs = {}

    def fake_analyze_product_image(**kwargs):
        seen_kwargs.update(kwargs)
        return {
            "recommendedKeywords": ["텀블러"],
            "recommendedSummary": "분석 결과",
            "features": {},
        }

    monkeypatch.setattr(main, "analyze_product_image", fake_analyze_product_image)
    client = TestClient(main.app)

    response = client.post(
        "/internal/analyze-image",
        headers=INTERNAL_HEADERS,
        files={"file": ("product.png", b"image-bytes", "image/png")},
        data={"geminiApiKeyOverride": "user-gemini-key"},
    )

    assert response.status_code == 200
    assert response.json()["recommendedSummary"] == "분석 결과"
    assert seen_kwargs["api_key_override"] == "user-gemini-key"


def test_internal_generate_rejects_missing_internal_secret(monkeypatch):
    def fake_generate_marketing_text(**_kwargs):
        raise AssertionError("internal auth should run before generation")

    monkeypatch.setattr(main, "generate_marketing_text", fake_generate_marketing_text)
    client = TestClient(main.app)

    response = client.post(
        "/internal/generate",
        json={
            "name": "product",
            "keywords": ["keyword"],
            "summary": "summary",
            "tone": "blog",
            "geminiApiKeyOverride": "user-gemini-key",
        },
    )

    assert response.status_code == 403
    assert "user-gemini-key" not in response.text
