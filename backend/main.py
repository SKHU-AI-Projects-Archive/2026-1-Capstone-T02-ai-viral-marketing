from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse

from backend.ai import analyze_product_image, generate_marketing_text
from backend.schemas import AnalyzeImageResponse, GenerateRequest, GenerateResponse


MAX_IMAGE_BYTES = 4 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_IMAGE_TYPE_LABEL = "JPG, PNG, WEBP"

app = FastAPI(title="OVMS AI Service")


def _model_to_dict(value):
    if value is None:
        return None
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return value.dict()


@app.get("/health")
def healthcheck():
    return {"status": "ok"}


@app.get("/", response_class=PlainTextResponse)
def read_root() -> str:
    return (
        "FastAPI 서버는 내부 AI API만 제공합니다.\n"
        "`npm start`로 Node 서버를 실행한 뒤 http://127.0.0.1:3000 으로 접속해 주세요.\n"
        "FastAPI 서버는 AI 백엔드로 계속 실행되어 있어야 합니다."
    )


@app.post("/internal/generate", response_model=GenerateResponse)
def generate_copy(payload: GenerateRequest) -> GenerateResponse:
    try:
        generated_text = generate_marketing_text(
            name=payload.name,
            keywords=payload.keywords,
            summary=payload.summary,
            image_analysis=_model_to_dict(payload.imageAnalysis),
            tone=payload.tone,
            user_id=payload.userId,
            api_key_override=payload.geminiApiKeyOverride,
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="마케팅 문구 생성에 실패했습니다.",
        ) from exc

    return GenerateResponse(generated_text=generated_text)


@app.post("/internal/analyze-image", response_model=AnalyzeImageResponse)
async def analyze_image(file: UploadFile = File(...)) -> AnalyzeImageResponse:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"지원하지 않는 이미지 형식입니다. {ALLOWED_IMAGE_TYPE_LABEL} 파일만 업로드해 주세요.",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="업로드된 이미지 파일이 비어 있습니다.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="이미지 파일은 4MB 이하만 업로드할 수 있습니다.")

    try:
        analysis = analyze_product_image(image_bytes=image_bytes, media_type=file.content_type)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="이미지 분석에 실패했습니다.") from exc

    return AnalyzeImageResponse(**analysis)
