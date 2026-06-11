type TonePromptBuilder = (
  name: string,
  keywords: string[],
  summary: string,
  imageBlock: string,
  blogImageBlock: string,
  exampleBlock: string
) => string;

function buildBlogPrompt(
  name: string,
  keywords: string[],
  summary: string,
  imageBlock: string,
  blogImageBlock: string,
  exampleBlock: string
): string {
  const imageOutputRules = blogImageBlock
    ? `- If Available blog images are provided, insert only relevant listed images using Markdown image syntax: ![alt text](URL)
- Use only the exact image URLs listed in Available blog images.
- Never output image://product or any image:// placeholder.
- Do not invent image URLs. Do not repeat the same image URL.
- If no Available blog images are provided, do not insert any image Markdown.`
    : "- Do not insert image Markdown because no displayable blog image URL was provided.";

  return `Write a Korean product blog post in the style of Naver / Tistory promotional reviews.
The post must read like a real user's experience review, not an obvious ad.

Product name: ${name}
Keywords: ${keywords.join(", ")}
Summary: ${summary}
${imageBlock}
${blogImageBlock}
${exampleBlock}

Output format (Markdown only, no code fences, no preamble):
- Start with a single H1 line: a catchy, click-friendly title.
- 200~300 Korean characters of intro paragraph that hooks the reader.
- Then 2~4 H2 sections. Each section should include short paragraphs or useful bullet lists.
- End with a soft CTA paragraph.

Image output rules:
${imageOutputRules}

Style requirements:
- Friendly first-person review tone in Korean.
- Use light emoji sparingly, never in headings.
- Avoid exaggerated advertising language.
- Reflect image analysis context only when relevant; do not invent unverifiable specs, brand claims, or performance numbers.
- Total length around 700~1200 Korean characters.
- Do not include the original keyword list verbatim; weave them naturally.`;
}

function buildCoupangReviewPrompt(
  name: string,
  keywords: string[],
  summary: string,
  imageBlock: string,
  _blogImageBlock: string,
  exampleBlock: string
): string {
  return `Write a short Korean product review in the style of Coupang product reviews.
Tone is a real customer who just received and tried the product, posting honest impressions.

Product name: ${name}
Keywords: ${keywords.join(", ")}
Summary: ${summary}
${imageBlock}
${exampleBlock}

Output format:
- No title heading. Start directly with the review paragraph.
- 1~2 short paragraphs, total 100~300 Korean characters.
- Do not insert images or image placeholders.
- Mention realistic review elements when relevant: delivery, packaging, first impression, use case, regret point.

Style requirements:
- Honest user voice, slightly casual but polite.
- Avoid advertising-like expressions.
- Do not invent specifications, brand claims, or comparisons that are not supported.
- Do not output keyword list verbatim.`;
}

function buildCommunityCommentPrompt(
  name: string,
  keywords: string[],
  summary: string,
  imageBlock: string,
  _blogImageBlock: string,
  exampleBlock: string
): string {
  return `Write a single Korean community comment that subtly promotes the product.
Tone is an ordinary forum / cafe / comment user casually mentioning the product in conversation.
The comment must not read like an advertisement.

Product name: ${name}
Keywords: ${keywords.join(", ")}
Summary: ${summary}
${imageBlock}
${exampleBlock}

Output format:
- Plain text only. No Markdown, no headings, no images.
- 1~2 sentences only. Total 50~150 Korean characters.
- Casual conversational Korean.

Style requirements:
- Sound like a real person sharing personal experience, not a marketer.
- Avoid advertising expressions, hashtags, and links.
- Do not invent specifications or brand claims.
- Do not output keyword list verbatim.`;
}

export const TONE_BUILDERS: Record<string, TonePromptBuilder> = {
  blog: buildBlogPrompt,
  coupang_review: buildCoupangReviewPrompt,
  community_comment: buildCommunityCommentPrompt,
};
