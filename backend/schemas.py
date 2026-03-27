from pydantic import BaseModel, Field


class GenerateRequest(BaseModel):
    name: str = Field(..., min_length=1, description="Product name")
    keywords: list[str] = Field(..., min_length=1, description="Keyword list")
    summary: str = Field(..., min_length=1, description="Product summary")


class GenerateResponse(BaseModel):
    generated_text: str
