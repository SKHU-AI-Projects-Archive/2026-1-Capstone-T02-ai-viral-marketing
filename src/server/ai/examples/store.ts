import { Collection, ObjectId, WithId } from "mongodb";

import type { Tone } from "../../generations/store";

export type GenerationExampleRecord = {
  userId?: ObjectId;
  userScope: "private" | "public";
  tone: Tone;
  name: string;
  keywords: string[];
  summary: string;
  generatedText: string;
  sourceText: string;
  source: "generated" | "seed";
  qualityScore: number;
  createdAt: Date;
};

export async function ensureGenerationExampleIndexes(collection: Collection<GenerationExampleRecord>): Promise<void> {
  await collection.createIndex({ userId: 1, tone: 1, createdAt: -1 });
  await collection.createIndex({ userScope: 1, tone: 1, createdAt: -1 });
  await collection.createIndex({ sourceText: "text" });
}

function uniqueTerms(values: string[]): Set<string> {
  return new Set(
    values
      .join(" ")
      .toLowerCase()
      .split(/[\s,.;:!?()[\]{}"'`~|/\\_-]+/u)
      .map((item) => item.trim())
      .filter(Boolean)
  );
}

function scoreExample(example: GenerationExampleRecord, queryTerms: Set<string>, summary: string): number {
  const exampleTerms = uniqueTerms([example.name, example.summary, example.keywords.join(" ")]);
  let score = example.qualityScore || 0;
  for (const term of queryTerms) {
    if (exampleTerms.has(term)) {
      score += 2;
    }
  }
  if (summary && example.sourceText.toLowerCase().includes(summary.toLowerCase().slice(0, 30))) {
    score += 3;
  }
  return score;
}

export async function querySimilarGenerationExamples(
  collection: Collection<GenerationExampleRecord>,
  params: {
    name: string;
    keywords: string[];
    summary: string;
    tone: Tone;
    userId?: string | null;
    limit?: number;
  }
): Promise<WithId<GenerationExampleRecord>[]> {
  const userObjectId = params.userId && ObjectId.isValid(params.userId) ? new ObjectId(params.userId) : null;
  const candidates = await collection
    .find({
      tone: params.tone,
      $or: [{ userScope: "public" }, ...(userObjectId ? [{ userScope: "private", userId: userObjectId } as const] : [])],
    })
    .sort({ createdAt: -1 })
    .limit(50)
    .toArray();

  const queryTerms = uniqueTerms([params.name, params.summary, params.keywords.join(" ")]);
  return candidates
    .map((example) => ({ example, score: scoreExample(example, queryTerms, params.summary) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, params.limit ?? 3)
    .map((item) => item.example);
}

export async function storeGenerationExample(
  collection: Collection<GenerationExampleRecord>,
  params: {
    name: string;
    keywords: string[];
    summary: string;
    generatedText: string;
    tone: Tone;
    userId?: string | null;
  }
): Promise<void> {
  const userObjectId = params.userId && ObjectId.isValid(params.userId) ? new ObjectId(params.userId) : null;
  const document: GenerationExampleRecord = {
    ...(userObjectId ? { userId: userObjectId } : {}),
    userScope: userObjectId ? "private" : "public",
    tone: params.tone,
    name: params.name,
    keywords: params.keywords,
    summary: params.summary,
    generatedText: params.generatedText,
    sourceText: `${params.name}\n${params.keywords.join(" ")}\n${params.summary}\n${params.generatedText}`,
    source: "generated",
    qualityScore: 1,
    createdAt: new Date(),
  };

  await collection.insertOne(document);
}
