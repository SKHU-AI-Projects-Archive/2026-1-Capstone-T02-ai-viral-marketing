import type { Collection } from "mongodb";

import type { GenerationExampleRecord } from "./examples/store";
import { querySimilarGenerationExamples, storeGenerationExample } from "./examples/store";
import { extractGeneratedText, GeminiOutputTruncatedError, postGemini } from "./geminiClient";
import { TONE_BUILDERS } from "./prompts/generation";
import type { BlogImage, GenerationInput, Tone } from "../generations/store";
import { sanitizeGeneratedTextImages } from "../generations/store";

const MAX_GENERATION_ATTEMPTS = 3;
const MAX_GENERATION_OUTPUT_TOKENS = 8192;

const TONE_GENERATION_CONFIG: Record<Tone, { maxOutputTokens: number; temperature: number }> = {
  blog: { maxOutputTokens: 8192, temperature: 0.85 },
  coupang_review: { maxOutputTokens: 2048, temperature: 0.9 },
  community_comment: { maxOutputTokens: 2048, temperature: 0.95 },
};

const MAX_REFERENCE_TEXT_CHARS: Record<Tone, number> = {
  blog: 1200,
  coupang_review: 420,
  community_comment: 260,
};

function formatImageAnalysisBlock(imageAnalysis: unknown): string {
  if (!imageAnalysis) {
    return "";
  }

  return `\n\nImage analysis context:\n${JSON.stringify(imageAnalysis, null, 2)}`;
}

function formatBlogImagesBlock(blogImages: BlogImage[] | undefined, tone: Tone): string {
  if (tone !== "blog" || !blogImages?.length) {
    return "";
  }

  const lines = ["Available blog images:"];
  blogImages.forEach((image, index) => {
    lines.push(`${index + 1}. Label: ${image.label.trim()}`);
    if (image.description?.trim()) {
      lines.push(`   Description: ${image.description.trim()}`);
    }
    if (image.placementHint?.trim()) {
      lines.push(`   Placement hint: ${image.placementHint.trim()}`);
    }
    lines.push(`   URL: ${image.displayUrl.trim()}`);
  });

  lines.push(
    "",
    "Image output rules:",
    "- Use only the exact URLs listed above.",
    "- Never output image://product or any image:// placeholder.",
    "- Use Markdown image syntax only: ![alt text](URL).",
    "- Include the product name and image label naturally in alt text.",
    "- Do not force every image if it makes the post awkward."
  );
  return `\n\n${lines.join("\n")}`;
}

function generationConfigForAttempt(tone: Tone, attempt: number): { maxOutputTokens: number; temperature: number } {
  const config = { ...TONE_GENERATION_CONFIG[tone] };
  config.maxOutputTokens = Math.min(config.maxOutputTokens * 2 ** attempt, MAX_GENERATION_OUTPUT_TOKENS);
  return config;
}

function clipReferenceText(text: string, tone: Tone): string {
  const normalized = text.trim();
  const maxChars = MAX_REFERENCE_TEXT_CHARS[tone] ?? 600;
  if (normalized.length <= maxChars) {
    return normalized;
  }
  return `${normalized.slice(0, maxChars).trimEnd()}...`;
}

async function formatExampleBlock(
  collection: Collection<GenerationExampleRecord>,
  input: GenerationInput,
  userId: string | null
): Promise<string> {
  const similarExamples = await querySimilarGenerationExamples(collection, {
    name: input.name,
    keywords: input.keywords,
    summary: input.summary,
    tone: input.tone,
    userId,
    limit: 3,
  });
  if (!similarExamples.length) {
    return "";
  }

  const formattedExamples = similarExamples.map(
    (example, index) => `Example ${index + 1}
- Product name: ${example.name}
- Keywords: ${example.keywords.join(", ")}
- Summary: ${example.summary}
- Generated text: ${clipReferenceText(example.generatedText, input.tone)}`
  );

  return `\n\nReference examples from previous successful generations:\n${formattedExamples.join("\n\n")}`;
}

export async function generateMarketingText(params: {
  input: GenerationInput;
  userId: string;
  apiKeyOverride: string;
  examplesCollection: Collection<GenerationExampleRecord>;
}): Promise<string> {
  const builder = TONE_BUILDERS[params.input.tone];
  if (!builder) {
    throw new Error(`Unsupported tone: ${params.input.tone}`);
  }

  const prompt = builder(
    params.input.name,
    params.input.keywords,
    params.input.summary,
    formatImageAnalysisBlock(params.input.imageAnalysis),
    formatBlogImagesBlock(params.input.blogImages, params.input.tone),
    await formatExampleBlock(params.examplesCollection, params.input, params.userId)
  );

  let generatedText = "";
  let lastTruncationError: GeminiOutputTruncatedError | null = null;
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const payload = {
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: generationConfigForAttempt(params.input.tone, attempt),
    };

    try {
      const response = await postGemini(payload, { apiKeyOverride: params.apiKeyOverride });
      generatedText = extractGeneratedText(response);
      break;
    } catch (error) {
      if (error instanceof GeminiOutputTruncatedError) {
        lastTruncationError = error;
        continue;
      }
      throw error;
    }
  }

  if (!generatedText) {
    throw new Error("AI 응답이 토큰 제한으로 중간에 끊겼습니다. 다시 시도해 주세요.", { cause: lastTruncationError });
  }

  const sanitized = sanitizeGeneratedTextImages(generatedText, params.input);
  await storeGenerationExample(params.examplesCollection, {
    name: params.input.name,
    keywords: params.input.keywords,
    summary: params.input.summary,
    generatedText: sanitized,
    tone: params.input.tone,
    userId: params.userId,
  });
  return sanitized;
}
