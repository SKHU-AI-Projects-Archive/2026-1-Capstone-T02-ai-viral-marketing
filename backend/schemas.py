from typing import Literal

from pydantic import BaseModel, Field


Tone = Literal["blog", "coupang_review", "community_comment"]


class ImageFeatures(BaseModel):
    category: str = ""
    colors: list[str] = Field(default_factory=list)
    materials: list[str] = Field(default_factory=list)
    style_keywords: list[str] = Field(default_factory=list)
    use_cases: list[str] = Field(default_factory=list)
    target_audience: list[str] = Field(default_factory=list)
    selling_points: list[str] = Field(default_factory=list)
    detected_text: list[str] = Field(default_factory=list)
    uncertainties: list[str] = Field(default_factory=list)


class ImageAnalysis(BaseModel):
    recommendedKeywords: list[str] = Field(default_factory=list)
    recommendedSummary: str = ""
    features: ImageFeatures = Field(default_factory=ImageFeatures)


class GenerateRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Product name")
    keywords: list[str] = Field(..., min_length=1, description="Keyword list")
    summary: str = Field(..., min_length=1, description="Product summary")
    tone: Tone = Field(default="blog", description="Output tone preset")
    imageAnalysis: ImageAnalysis | None = None
    userId: str | None = Field(default=None, description="Internal user id for private example retrieval")
    geminiApiKeyOverride: str | None = Field(
        default=None,
        description="Internal per-request Gemini API key override",
        exclude=True,
    )


class GenerateResponse(BaseModel):
    generated_text: str


class AnalyzeImageResponse(ImageAnalysis):
    pass
