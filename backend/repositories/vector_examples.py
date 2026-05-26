from typing import Any

from backend.vector_store import query_similar_examples, store_generated_example


def query_similar_generation_examples(
    name: str,
    keywords: list[str],
    summary: str,
    tone: str,
    user_id: str | None = None,
    limit: int = 3,
) -> list[dict[str, Any]]:
    return query_similar_examples(name=name, keywords=keywords, summary=summary, tone=tone, user_id=user_id, limit=limit)


def store_generation_example(
    name: str,
    keywords: list[str],
    summary: str,
    generated_text: str,
    tone: str,
    user_id: str | None = None,
) -> str:
    return store_generated_example(
        name=name,
        keywords=keywords,
        summary=summary,
        generated_text=generated_text,
        tone=tone,
        user_id=user_id,
    )
