import hashlib
import json
import math
import os
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, Literal

import chromadb


BASE_DIR = Path(__file__).resolve().parent.parent
CHROMA_DIR = Path(os.getenv("CHROMA_DB_PATH", BASE_DIR / ".chroma"))
COLLECTION_NAME = "marketing_examples"
EMBEDDING_DIMENSION = 256
DEFAULT_QUALITY_SCORE = 1.0
DEFAULT_SOURCE = "generated"
DEFAULT_USER_SCOPE = "private"

UserScope = Literal["private", "public"]

_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
_collection = _client.get_or_create_collection(name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"})


def _compose_source_text(
    name: str,
    keywords: list[str],
    summary: str,
    generated_text: str = "",
    tone: str | None = None,
) -> str:
    parts = [
        f"name: {name.strip()}",
        f"keywords: {', '.join(keyword.strip() for keyword in keywords if keyword.strip())}",
        f"summary: {summary.strip()}",
    ]
    if tone:
        parts.append(f"tone: {tone.strip()}")
    if generated_text.strip():
        parts.append(f"generated_text: {generated_text.strip()}")
    return "\n".join(parts)


def _tokenize(text: str) -> list[str]:
    lowered = text.lower()
    cleaned = []
    for char in lowered:
        cleaned.append(char if char.isalnum() else " ")
    return [token for token in "".join(cleaned).split() if token]


def _embed_text(text: str) -> list[float]:
    vector = [0.0] * EMBEDDING_DIMENSION
    for token in _tokenize(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % EMBEDDING_DIMENSION
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        weight = 1.0 + (digest[5] / 255.0)
        vector[index] += sign * weight

    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def _build_metadata(
    name: str,
    keywords: list[str],
    summary: str,
    generated_text: str,
    tone: str,
    user_id: str | None,
    user_scope: UserScope,
    quality_score: float,
    source: str,
) -> dict[str, Any]:
    metadata: dict[str, Any] = {
        "name": name,
        "keywords_json": json.dumps(keywords, ensure_ascii=False),
        "summary": summary,
        "generated_text": generated_text,
        "tone": tone,
        "user_scope": user_scope,
        "quality_score": quality_score,
        "source": source,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if user_id:
        metadata["user_id"] = user_id
    return metadata


def _normalize_user_scope(user_scope: str | None) -> UserScope:
    return "public" if user_scope == "public" else "private"


def _normalize_quality_score(quality_score: float | int | None) -> float:
    if quality_score is None:
        return DEFAULT_QUALITY_SCORE
    return max(0.0, min(float(quality_score), 1.0))


def _build_query_filter(tone: str | None, user_id: str | None) -> dict[str, Any]:
    filters: list[dict[str, Any]] = []
    if tone:
        filters.append({"tone": tone})

    scope_filter: dict[str, Any]
    if user_id:
        scope_filter = {"$or": [{"user_scope": "public"}, {"user_id": user_id}]}
    else:
        scope_filter = {"user_scope": "public"}
    filters.append(scope_filter)

    if len(filters) == 1:
        return filters[0]
    return {"$and": filters}


def store_generated_example(
    name: str,
    keywords: list[str],
    summary: str,
    generated_text: str,
    tone: str = "blog",
    user_id: str | None = None,
    user_scope: str | None = DEFAULT_USER_SCOPE,
    quality_score: float | int | None = DEFAULT_QUALITY_SCORE,
    source: str = DEFAULT_SOURCE,
) -> str:
    normalized_user_scope = _normalize_user_scope(user_scope)
    document = _compose_source_text(
        name=name,
        keywords=keywords,
        summary=summary,
        generated_text=generated_text,
        tone=tone,
    )
    doc_id = hashlib.sha256(document.encode("utf-8")).hexdigest()
    if user_id and normalized_user_scope == "private":
        doc_id = hashlib.sha256(f"{user_id}\n{document}".encode("utf-8")).hexdigest()
    _collection.upsert(
        ids=[doc_id],
        documents=[document],
        metadatas=[
            _build_metadata(
                name=name,
                keywords=keywords,
                summary=summary,
                generated_text=generated_text,
                tone=tone,
                user_id=user_id,
                user_scope=normalized_user_scope,
                quality_score=_normalize_quality_score(quality_score),
                source=source,
            )
        ],
        embeddings=[_embed_text(document)],
    )
    return doc_id


def query_similar_examples(
    name: str,
    keywords: list[str],
    summary: str,
    limit: int = 3,
    tone: str | None = None,
    user_id: str | None = None,
) -> list[dict[str, Any]]:
    if limit <= 0:
        return []

    query_document = _compose_source_text(name=name, keywords=keywords, summary=summary, tone=tone)
    query_args: dict[str, Any] = {
        "query_embeddings": [_embed_text(query_document)],
        "n_results": limit,
        "include": ["metadatas", "distances"],
        "where": _build_query_filter(tone, user_id),
    }

    result = _collection.query(
        **query_args,
    )

    matches: list[dict[str, Any]] = []
    metadatas = result.get("metadatas") or []
    distances = result.get("distances") or []

    for index, metadata in enumerate(metadatas[0] if metadatas else []):
        if not metadata:
            continue
        distance = None
        if distances and distances[0] and index < len(distances[0]):
            distance = distances[0][index]
        matches.append(
            {
                "name": metadata.get("name", ""),
                "keywords": json.loads(metadata.get("keywords_json", "[]")),
                "summary": metadata.get("summary", ""),
                "generated_text": metadata.get("generated_text", ""),
                "tone": metadata.get("tone", ""),
                "user_scope": metadata.get("user_scope", ""),
                "user_id": metadata.get("user_id", ""),
                "quality_score": metadata.get("quality_score"),
                "source": metadata.get("source", ""),
                "created_at": metadata.get("created_at", ""),
                "distance": distance,
            }
        )

    return matches
