from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.responses import PlainTextResponse
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.ai import analyze_product_image, generate_marketing_text
from backend.schemas import AnalyzeImageResponse, GenerateRequest, GenerateResponse


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_SRC_DIR = BASE_DIR / "frontend"
FRONTEND_DIST_DIR = FRONTEND_SRC_DIR / "dist"
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 4 * 1024 * 1024

app = FastAPI(title="OVMS MVP")
app.mount("/assets", StaticFiles(directory=FRONTEND_DIST_DIR / "assets", check_dir=False), name="assets")


def _model_to_dict(value):
    if value is None:
        return None
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return value.dict()


@app.get("/")
def read_index():
    if not (FRONTEND_DIST_DIR / "index.html").exists():
        return PlainTextResponse(
            "Frontend build not found. Run `npm install` and `npm run build` in the frontend directory.",
            status_code=503,
        )
    return FileResponse(FRONTEND_DIST_DIR / "index.html")


@app.get("/favicon.ico")
def read_favicon() -> FileResponse:
    return FileResponse(FRONTEND_DIST_DIR / "favicon.svg", media_type="image/svg+xml")


@app.post("/generate", response_model=GenerateResponse)
def generate_copy(payload: GenerateRequest) -> GenerateResponse:
    try:
        generated_text = generate_marketing_text(
            name=payload.name,
            keywords=payload.keywords,
            summary=payload.summary,
            image_analysis=_model_to_dict(payload.imageAnalysis),
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate marketing text.",
        ) from exc

    return GenerateResponse(generated_text=generated_text)


@app.post("/analyze-image", response_model=AnalyzeImageResponse)
async def analyze_image(file: UploadFile = File(...)) -> AnalyzeImageResponse:
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(
            status_code=400,
            detail="지원하지 않는 이미지 형식입니다. JPG, PNG, WEBP 파일만 업로드해 주세요.",
        )

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="이미지 파일이 비어 있습니다.")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="이미지 파일은 4MB 이하만 업로드할 수 있습니다.")

    try:
        analysis = analyze_product_image(image_bytes=image_bytes, media_type=file.content_type)
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail="Failed to analyze product image.") from exc

    return AnalyzeImageResponse(**analysis)


@app.get("/{full_path:path}")
def read_frontend_app(full_path: str):
    if not (FRONTEND_DIST_DIR / "index.html").exists():
        return PlainTextResponse(
            "Frontend build not found. Run `npm install` and `npm run build` in the frontend directory.",
            status_code=503,
        )
    return FileResponse(FRONTEND_DIST_DIR / "index.html")
