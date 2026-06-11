from collections.abc import Callable


def _build_blog_prompt(
    name: str,
    keywords: list[str],
    summary: str,
    image_block: str,
    blog_image_block: str,
    example_block: str,
) -> str:
    image_output_rules = (
        """- If Available blog images are provided, insert only relevant listed images using Markdown image syntax: ![alt text](URL)
- Use only the exact image URLs listed in Available blog images.
- Never output image://product or any image:// placeholder.
- Do not invent image URLs. Do not repeat the same image URL.
- If no Available blog images are provided, do not insert any image Markdown."""
        if blog_image_block
        else "- Do not insert image Markdown because no displayable blog image URL was provided."
    )

    return f"""Write a Korean product blog post in the style of Naver / Tistory promotional reviews.
The post must read like a real user's experience review, not an obvious ad.

Product name: {name}
Keywords: {", ".join(keywords)}
Summary: {summary}
{image_block}
{blog_image_block}
{example_block}

Output format (Markdown only, no code fences, no preamble):
- Start with a single H1 line: a catchy, click-friendly title (no clickbait, no all-caps)
- 200~300 Korean characters of intro paragraph that hooks the reader
- Then 2~4 H2 sections. Each section: short paragraph(s), use bullet lists when comparing or listing features
- End with a soft CTA paragraph (구매 / 방문 / 더 알아보기 등)

Image output rules:
{image_output_rules}

Style requirements:
- Friendly first-person review tone in Korean (존댓말, "저는", "써보니" 등)
- Use light emoji sparingly (0~3 total, never in headings)
- Avoid exaggerated advertising language ("최고", "무조건", "강력 추천 100%")
- Reflect image analysis context only when it is relevant; do not invent unverifiable specs, brand claims, or performance numbers
- Total length around 700~1200 Korean characters
- Do not include the original keyword list verbatim; weave them naturally"""


def _build_coupang_review_prompt(
    name: str,
    keywords: list[str],
    summary: str,
    image_block: str,
    blog_image_block: str,
    example_block: str,
) -> str:
    return f"""Write a short Korean product review in the style of Coupang product reviews.
Tone is a real customer who just received and tried the product, posting honest impressions.

Product name: {name}
Keywords: {", ".join(keywords)}
Summary: {summary}
{image_block}
{example_block}

Output format (Markdown allowed but minimal):
- No title heading. Start directly with the review paragraph.
- 1~2 short paragraphs in 존댓말, total 100~300 Korean characters.
- Do not insert images or image placeholders.
- Mention realistic review elements when relevant: 배송 속도, 포장 상태, 첫인상, 사용감, 재구매 의사.
- Light emoji is encouraged (1~4). Never use heading syntax.

Style requirements:
- Honest user voice, slightly casual but polite (존댓말).
- Avoid advertising-like expressions ("강추", "꼭 사세요", "무조건 사세요").
- Do not invent specifications, brand claims, or comparisons that are not supported.
- Do not output keyword list verbatim."""


def _build_community_comment_prompt(
    name: str,
    keywords: list[str],
    summary: str,
    image_block: str,
    blog_image_block: str,
    example_block: str,
) -> str:
    return f"""Write a single Korean community comment that subtly promotes the product.
Tone is an ordinary forum / cafe / comment user casually mentioning the product in conversation.
The comment must NOT read like an advertisement.

Product name: {name}
Keywords: {", ".join(keywords)}
Summary: {summary}
{image_block}
{example_block}

Output format (plain text, no Markdown, no headings, no images):
- 1~2 sentences only. Total 50~150 Korean characters.
- Casual conversational Korean (반말 또는 가벼운 존댓말, 실제 댓글 톤에 맞게).
- Do not insert images or any image placeholder.
- Optional: at most one light emoji or casual expression.

Style requirements:
- Sound like a real person sharing personal experience, not a marketer.
- Avoid advertising expressions ("정말 추천", "강추", "꼭 사세요", "할인 중") and avoid hashtags / links.
- Do not invent specifications or brand claims.
- Do not output keyword list verbatim; weave naturally."""


TonePromptBuilder = Callable[[str, list[str], str, str, str, str], str]

TONE_BUILDERS: dict[str, TonePromptBuilder] = {
    "blog": _build_blog_prompt,
    "coupang_review": _build_coupang_review_prompt,
    "community_comment": _build_community_comment_prompt,
}
