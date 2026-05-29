import { Collection, ObjectId, WithId } from "mongodb";

export type Tone = "blog" | "coupang_review" | "community_comment";

export type GenerationRecord = {
  userId: ObjectId;
  name: string;
  keywords: string[];
  summary: string;
  tone: Tone;
  imageAnalysis: unknown;
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
};

export type GenerationResponse = {
  id: string;
  name: string;
  keywords: string[];
  summary: string;
  tone: Tone;
  generated_text: string;
  imageAnalysisApplied: boolean;
  saveSource: "auto";
  createdAt: Date;
  updatedAt: Date;
};

export type GenerationListItem = Omit<GenerationResponse, "generated_text"> & {
  preview: string;
};

const ALLOWED_TONES: readonly Tone[] = ["blog", "coupang_review", "community_comment"];
const PREVIEW_LIMIT_BY_TONE: Record<Tone, number> = {
  blog: 160,
  coupang_review: 500,
  community_comment: 500,
};

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

export function normalizeGenerationInput(value: unknown): GenerationInput {
  const body = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    name: String(body.name || "").trim(),
    keywords: normalizeKeywords(body.keywords),
    summary: String(body.summary || "").trim(),
    tone: normalizeTone(body.tone),
    ...(body.imageAnalysis ? { imageAnalysis: body.imageAnalysis } : {}),
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

  return null;
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
    saveSource: response.saveSource,
    createdAt: response.createdAt,
    updatedAt: response.updatedAt,
    preview: compactText.length > previewLimit ? `${compactText.slice(0, previewLimit - 3)}...` : compactText,
  };
}
