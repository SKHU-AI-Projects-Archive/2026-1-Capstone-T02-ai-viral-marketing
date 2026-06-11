import { Collection, ObjectId, WithId } from "mongodb";

export type Tone = "blog" | "coupang_review" | "community_comment";

export type BlogImage = {
  id: string;
  label: string;
  description?: string;
  placementHint?: string;
  sourceUrl: string;
  displayUrl: string;
  cloudinaryPublicId: string;
  width?: number;
  height?: number;
  format?: string;
};

export type GenerationRecord = {
  userId: ObjectId;
  name: string;
  keywords: string[];
  summary: string;
  tone: Tone;
  imageAnalysis: unknown;
  blogImages?: BlogImage[];
  generatedText: string;
  saveSource: "auto";
  createdAt: Date;
  updatedAt: Date;
};

export type GenerationInput = {
  name: string;
  keywords: string[];
  summary: string;
  tone: Tone;
  imageAnalysis?: unknown;
  blogImages?: BlogImage[];
};

export type GenerationResponse = {
  id: string;
  name: string;
  keywords: string[];
  summary: string;
  tone: Tone;
  generated_text: string;
  imageAnalysisApplied: boolean;
  blogImages: BlogImage[];
  saveSource: "auto";
  createdAt: Date;
  updatedAt: Date;
};

export type GenerationListItem = Omit<GenerationResponse, "generated_text"> & {
  preview: string;
};

const ALLOWED_TONES: readonly Tone[] = ["blog", "coupang_review", "community_comment"];
const MAX_BLOG_IMAGES = 5;
const PREVIEW_LIMIT_BY_TONE: Record<Tone, number> = {
  blog: 160,
  coupang_review: 500,
  community_comment: 500,
};
const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\(([^)\s]+)[^)]*\)/g;
const MARKDOWN_IMAGE_LINE_PATTERN = /^!\[[^\]]*]\(([^)\s]+)[^)]*\)\s*$/gm;
const IMAGE_PLACEHOLDER_URL_PATTERN = /image:\/\/[^)\s]+/g;

function hasImageAnalysis(value: unknown): boolean {
  return value !== null && value !== undefined;
}

export function normalizeTone(value: unknown): Tone {
  return ALLOWED_TONES.includes(value as Tone) ? (value as Tone) : "blog";
}

function normalizeKeywords(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((keyword) => String(keyword || "").trim())
    .filter(Boolean);
}

function readStringField(source: Record<string, unknown>, name: string): string {
  return String(source[name] || "").trim();
}

function normalizeBlogImages(value: unknown): BlogImage[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index): BlogImage | null => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const source = item as Record<string, unknown>;
      const sourceUrl = readStringField(source, "sourceUrl");
      const displayUrl = readStringField(source, "displayUrl");
      const cloudinaryPublicId = readStringField(source, "cloudinaryPublicId");
      const width = Number(source.width);
      const height = Number(source.height);

      return {
        id: readStringField(source, "id") || cloudinaryPublicId || `img_${index + 1}`,
        label: readStringField(source, "label"),
        ...(readStringField(source, "description") ? { description: readStringField(source, "description") } : {}),
        ...(readStringField(source, "placementHint") ? { placementHint: readStringField(source, "placementHint") } : {}),
        sourceUrl,
        displayUrl,
        cloudinaryPublicId,
        ...(Number.isFinite(width) && width > 0 ? { width } : {}),
        ...(Number.isFinite(height) && height > 0 ? { height } : {}),
        ...(readStringField(source, "format") ? { format: readStringField(source, "format") } : {}),
      };
    })
    .filter((item): item is BlogImage => Boolean(item));
}

function isSafeLabel(value: string): boolean {
  return Boolean(value) && !/[<>\n\r]/.test(value) && !value.includes("![") && !/^https?:\/\//i.test(value);
}

function isCloudinaryUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && parsed.hostname === "res.cloudinary.com";
  } catch (_error) {
    return false;
  }
}

export function normalizeGenerationInput(value: unknown): GenerationInput {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  const tone = normalizeTone(body.tone);

  return {
    name: String(body.name || "").trim(),
    keywords: normalizeKeywords(body.keywords),
    summary: String(body.summary || "").trim(),
    tone,
    ...(body.imageAnalysis ? { imageAnalysis: body.imageAnalysis } : {}),
    ...(body.blogImages ? { blogImages: normalizeBlogImages(body.blogImages) } : {}),
  };
}

export function validateGenerationInput(input: GenerationInput): string | null {
  if (!input.name) {
    return "제품명을 입력해 주세요.";
  }

  if (!input.keywords.length) {
    return "키워드를 하나 이상 입력해 주세요.";
  }

  if (!input.summary) {
    return "제품 요약을 입력해 주세요.";
  }

  const blogImages = input.blogImages ?? [];
  if (input.tone !== "blog" && blogImages.length > 0) {
    return "블로그 이미지 삽입은 블로그 톤에서만 사용할 수 있습니다.";
  }

  if (blogImages.length > MAX_BLOG_IMAGES) {
    return `블로그 이미지는 최대 ${MAX_BLOG_IMAGES}개까지 등록할 수 있습니다.`;
  }

  const labels = new Set<string>();
  const cloudinaryPublicIds = new Set<string>();
  for (const image of blogImages) {
    if (!isSafeLabel(image.label)) {
      return "블로그 이미지 라벨을 올바르게 입력해 주세요.";
    }
    const normalizedLabel = image.label.toLowerCase();
    if (labels.has(normalizedLabel)) {
      return "블로그 이미지 라벨은 중복될 수 없습니다.";
    }
    labels.add(normalizedLabel);

    if (!image.cloudinaryPublicId) {
      return "Cloudinary 이미지 ID가 없습니다.";
    }
    if (cloudinaryPublicIds.has(image.cloudinaryPublicId)) {
      return "동일한 블로그 이미지는 한 번만 등록할 수 있습니다.";
    }
    cloudinaryPublicIds.add(image.cloudinaryPublicId);

    if (!isCloudinaryUrl(image.displayUrl) || (image.sourceUrl && !isCloudinaryUrl(image.sourceUrl))) {
      return "Cloudinary 이미지 URL이 올바르지 않습니다.";
    }
  }

  return null;
}

export function sanitizeGeneratedTextImages(generatedText: string, input: GenerationInput): string {
  const allowedUrls = new Set((input.tone === "blog" ? input.blogImages ?? [] : []).map((image) => image.displayUrl));

  return generatedText
    .replace(MARKDOWN_IMAGE_LINE_PATTERN, (fullLine: string, rawUrl: string) => {
      if (rawUrl.startsWith("image://")) {
        return "";
      }
      if (!allowedUrls.has(rawUrl)) {
        return "";
      }
      return fullLine;
    })
    .replace(MARKDOWN_IMAGE_PATTERN, (fullMatch: string, rawUrl: string) => {
      if (rawUrl.startsWith("image://")) {
        return "";
      }
      if (!allowedUrls.has(rawUrl)) {
        return "";
      }
      return fullMatch;
    })
    .replace(IMAGE_PLACEHOLDER_URL_PATTERN, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function ensureGenerationIndexes(collection: Collection<GenerationRecord>): Promise<void> {
  await collection.createIndex({ userId: 1, createdAt: -1 });
}

export async function saveGeneratedArticle(
  collection: Collection<GenerationRecord>,
  userId: string,
  input: GenerationInput,
  generatedText: string
): Promise<WithId<GenerationRecord>> {
  const now = new Date();
  const document: GenerationRecord = {
    userId: new ObjectId(userId),
    name: input.name,
    keywords: input.keywords,
    summary: input.summary,
    tone: input.tone,
    imageAnalysis: input.imageAnalysis ?? null,
    blogImages: input.tone === "blog" ? input.blogImages ?? [] : [],
    generatedText,
    saveSource: "auto",
    createdAt: now,
    updatedAt: now,
  };

  const insertResult = await collection.insertOne(document);
  return {
    _id: insertResult.insertedId,
    ...document,
  };
}

export async function findGenerationForUser(
  collection: Collection<GenerationRecord>,
  userId: string,
  generationId: string
): Promise<WithId<GenerationRecord> | null> {
  if (!ObjectId.isValid(generationId)) {
    return null;
  }

  return collection.findOne({
    _id: new ObjectId(generationId),
    userId: new ObjectId(userId),
  });
}

export async function listGenerationsForUser(
  collection: Collection<GenerationRecord>,
  userId: string,
  limit: number
): Promise<WithId<GenerationRecord>[]> {
  return collection
    .find({ userId: new ObjectId(userId) })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
}

export function toGenerationResponse(record: WithId<GenerationRecord>): GenerationResponse {
  return {
    id: record._id.toString(),
    name: record.name,
    keywords: record.keywords,
    summary: record.summary,
    tone: record.tone,
    generated_text: record.generatedText,
    imageAnalysisApplied: hasImageAnalysis(record.imageAnalysis),
    blogImages: record.blogImages ?? [],
    saveSource: record.saveSource ?? "auto",
    createdAt: record.createdAt,
    updatedAt: record.updatedAt ?? record.createdAt,
  };
}

export function toGenerationListItem(record: WithId<GenerationRecord>): GenerationListItem {
  const response = toGenerationResponse(record);
  const compactText = response.generated_text.replace(/\s+/g, " ").trim();
  const previewLimit = PREVIEW_LIMIT_BY_TONE[response.tone] ?? PREVIEW_LIMIT_BY_TONE.blog;

  return {
    id: response.id,
    name: response.name,
    keywords: response.keywords,
    summary: response.summary,
    tone: response.tone,
    imageAnalysisApplied: response.imageAnalysisApplied,
    blogImages: response.blogImages,
    saveSource: response.saveSource,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    preview: compactText.length > previewLimit ? `${compactText.slice(0, previewLimit - 3)}...` : compactText,
  };
}
