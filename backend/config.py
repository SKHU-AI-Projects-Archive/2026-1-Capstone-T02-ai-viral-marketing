import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env", override=True)

DEFAULT_GEMINI_MODEL = "gemini-2.5-flash"
DEFAULT_GEMINI_TIMEOUT_SECONDS = 110.0
DEFAULT_INTERNAL_API_SECRET = "development-internal-api-secret"
MIN_GENERATE_TIMEOUT_SECONDS = 15.0
MIN_IMAGE_ANALYSIS_TIMEOUT_SECONDS = 30.0


@dataclass(frozen=True)
class GeminiSettings:
    model: str
    generate_timeout_seconds: float
    image_timeout_seconds: float
    internal_api_secret: str


def _read_env(name: str) -> str:
    return str(os.getenv(name) or "").strip()


def _normalize_model_name(model: str) -> str:
    normalized = model.strip()
    if not normalized:
        raise ValueError("GEMINI_MODEL environment variable is empty.")
    if normalized.startswith("models/"):
        normalized = normalized[len("models/") :]
    return normalized


def _parse_positive_float(name: str, default: float) -> float:
    raw_value = _read_env(name)
    if not raw_value:
        return default

    try:
        value = float(raw_value)
    except ValueError as exc:
        raise ValueError(f"{name} must be a positive number.") from exc

    if value <= 0:
        raise ValueError(f"{name} must be greater than 0.")
    return value


def _read_node_env() -> str:
    return _read_env("NODE_ENV") or "development"


def _read_internal_api_secret() -> str:
    secret = _read_env("INTERNAL_API_SECRET")
    if secret:
        return secret
    if _read_node_env() == "production":
        raise ValueError("production requires INTERNAL_API_SECRET to protect internal AI endpoints.")
    return DEFAULT_INTERNAL_API_SECRET


@lru_cache(maxsize=1)
def get_gemini_settings() -> GeminiSettings:
    base_timeout = _parse_positive_float("GEMINI_TIMEOUT_SECONDS", DEFAULT_GEMINI_TIMEOUT_SECONDS)
    generate_timeout = _parse_positive_float("GEMINI_GENERATE_TIMEOUT_SECONDS", base_timeout)
    image_timeout = _parse_positive_float("GEMINI_IMAGE_TIMEOUT_SECONDS", base_timeout)

    return GeminiSettings(
        model=_normalize_model_name(_read_env("GEMINI_MODEL") or DEFAULT_GEMINI_MODEL),
        generate_timeout_seconds=max(generate_timeout, MIN_GENERATE_TIMEOUT_SECONDS),
        image_timeout_seconds=max(image_timeout, MIN_IMAGE_ANALYSIS_TIMEOUT_SECONDS),
        internal_api_secret=_read_internal_api_secret(),
    )
