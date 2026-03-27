import hashlib
import json
import math
import os
from pathlib import Path
from typing import Any

import chromadb


BASE_DIR = Path(__file__).resolve().parent.parent
CHROMA_DIR = Path(os.getenv("CHROMA_DB_PATH", BASE_DIR / ".chroma"))
COLLECTION_NAME = "marketing_examples"
EMBEDDING_DIMENSION = 256

_client = chromadb.PersistentClient(path=str(CHROMA_DIR))
_collection = _client.get_or_create_collection(name=COLLECTION_NAME, metadata={"hnsw:space": "cosine"})


def _compose_source_text(name: str, keywords: list[str], summary: str, generated_text: str = "") -> str:
    parts = [
        f"name: {name.strip()}",
        f"keywords: {', '.join(keyword.strip() for keyword in keywords if keyword.strip())}",
        f"summary: {summary.strip()}",
    ]
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


def _build_metadata(name: str, keywords: list[str], summary: str, generated_text: str) -> dict[str, Any]:
    return {
        "name": name,
        "keywords_json": json.dumps(keywords, ensure_ascii=False),
        "summary": summary,
        "generated_text": generated_text,
    }


def store_generated_example(name: str, keywords: list[str], summary: str, generated_text: str) -> str:
    document = _compose_source_text(name=name, keywords=keywords, summary=summary, generated_text=generated_text)
    doc_id = hashlib.sha256(document.encode("utf-8")).hexdigest()
    _collection.upsert(
        ids=[doc_id],
        documents=[document],
        metadatas=[_build_metadata(name=name, keywords=keywords, summary=summary, generated_text=generated_text)],
        embeddings=[_embed_text(document)],
    )
    return doc_id


def query_similar_examples(name: str, keywords: list[str], summary: str, limit: int = 3) -> list[dict[str, Any]]:
    if limit <= 0:
        return []

    query_document = _compose_source_text(name=name, keywords=keywords, summary=summary)
    result = _collection.query(
        query_embeddings=[_embed_text(query_document)],
        n_results=limit,
        include=["metadatas", "distances"],
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
                "distance": distance,
            }
        )

    return matches
