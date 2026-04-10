from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import PlainTextResponse
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from backend.ai import generate_marketing_text
from backend.schemas import GenerateRequest, GenerateResponse


BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_SRC_DIR = BASE_DIR / "frontend"
FRONTEND_DIST_DIR = FRONTEND_SRC_DIR / "dist"

app = FastAPI(title="OVMS MVP")
app.mount("/assets", StaticFiles(directory=FRONTEND_DIST_DIR / "assets", check_dir=False), name="assets")


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
        )
    except ValueError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail="Failed to generate marketing text.",
        ) from exc

    return GenerateResponse(generated_text=generated_text)


@app.get("/{full_path:path}")
def read_frontend_app(full_path: str):
    if not (FRONTEND_DIST_DIR / "index.html").exists():
        return PlainTextResponse(
            "Frontend build not found. Run `npm install` and `npm run build` in the frontend directory.",
            status_code=503,
        )
    return FileResponse(FRONTEND_DIST_DIR / "index.html")
