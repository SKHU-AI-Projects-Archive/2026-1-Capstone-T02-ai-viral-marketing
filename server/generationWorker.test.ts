import { ObjectId, WithId } from "mongodb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRecord } from "./db";
import type { GenerationRecord } from "./generationStore";
import type { AiJobRecord } from "./jobStore";
import { encryptGeminiApiKey } from "./services/apiKeyCrypto";
import { postFastApiJson } from "./services/fastApiClient";
import { processGenerationJob } from "./workers/generationWorker";

vi.mock("./services/fastApiClient", () => ({
  postFastApiJson: vi.fn(),
}));

const TEST_API_KEY_SECRET = Buffer.from("12345678901234567890123456789012", "utf8").toString("base64");

class FakeUsersCollection {
  readonly records: WithId<UserRecord>[] = [];

  async findOne(query: { _id?: ObjectId }): Promise<WithId<UserRecord> | null> {
    return this.records.find((record) => !query._id || record._id.equals(query._id)) ?? null;
  }
}

class FakeJobsCollection {
  readonly records: WithId<AiJobRecord>[] = [];

  async findOne(query: { _id?: ObjectId }): Promise<WithId<AiJobRecord> | null> {
    return this.records.find((record) => !query._id || record._id.equals(query._id)) ?? null;
  }

  async updateOne(
    query: { _id?: ObjectId },
    update: { $set?: Partial<AiJobRecord>; $unset?: Record<string, string> }
  ): Promise<void> {
    const record = await this.findOne(query);
    if (!record) return;

    if (update.$set) {
      Object.assign(record, update.$set);
    }
    if (update.$unset) {
      for (const key of Object.keys(update.$unset)) {
        delete (record as unknown as Record<string, unknown>)[key];
      }
    }
  }
}

class FakeGenerationsCollection {
  readonly records: WithId<GenerationRecord>[] = [];

  async insertOne(document: GenerationRecord): Promise<{ insertedId: ObjectId }> {
    const insertedId = new ObjectId();
    this.records.push({ ...document, _id: insertedId });
    return { insertedId };
  }
}

function createJob(userId: ObjectId): WithId<AiJobRecord> {
  const now = new Date("2026-05-29T00:00:00.000Z");
  return {
    _id: new ObjectId(),
    userId,
    type: "generation",
    status: "queued",
    input: {
      name: "텀블러",
      keywords: ["보온"],
      summary: "보온성이 좋은 텀블러",
      tone: "blog",
    },
    result: null,
    error: null,
    attempts: 0,
    maxAttempts: 3,
    queuedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

function createCollections() {
  return {
    usersCollection: new FakeUsersCollection(),
    jobsCollection: new FakeJobsCollection(),
    generationsCollection: new FakeGenerationsCollection(),
  };
}

describe("processGenerationJob", () => {
  beforeEach(() => {
    vi.mocked(postFastApiJson).mockReset();
  });

  it("uses the saved user Gemini API key only in the internal FastAPI request", async () => {
    const collections = createCollections();
    const userId = new ObjectId();
    const apiKey = "AIza-user-secret-key";
    const job = createJob(userId);
    collections.usersCollection.records.push({
      _id: userId,
      name: "alpha",
      email: "alpha@example.com",
      passwordHash: "hash",
      createdAt: new Date("2026-05-28T00:00:00.000Z"),
      geminiApiKey: encryptGeminiApiKey(apiKey, TEST_API_KEY_SECRET),
    });
    collections.jobsCollection.records.push(job);
    vi.mocked(postFastApiJson).mockResolvedValue(
      new Response(JSON.stringify({ generated_text: "생성된 문구" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    );

    await processGenerationJob(collections as never, job._id.toString(), 1, {
      userApiKeyEncryptionSecret: TEST_API_KEY_SECRET,
      requireUserGeminiApiKey: false,
    });

    expect(postFastApiJson).toHaveBeenCalledWith(
      "/internal/generate",
      expect.objectContaining({
        name: "텀블러",
        userId: userId.toString(),
        geminiApiKeyOverride: apiKey,
      })
    );
    expect(job.input).not.toHaveProperty("geminiApiKeyOverride");
    expect(JSON.stringify(job)).not.toContain(apiKey);
    expect(job.status).toBe("succeeded");
    expect(collections.generationsCollection.records).toHaveLength(1);
  });

  it("fails the job without calling FastAPI when a user key is required but missing", async () => {
    const collections = createCollections();
    const userId = new ObjectId();
    const job = createJob(userId);
    collections.usersCollection.records.push({
      _id: userId,
      name: "alpha",
      email: "alpha@example.com",
      passwordHash: "hash",
      createdAt: new Date("2026-05-28T00:00:00.000Z"),
    });
    collections.jobsCollection.records.push(job);

    await processGenerationJob(collections as never, job._id.toString(), 1, {
      userApiKeyEncryptionSecret: TEST_API_KEY_SECRET,
      requireUserGeminiApiKey: true,
    });

    expect(postFastApiJson).not.toHaveBeenCalled();
    expect(job.status).toBe("failed");
    expect(job.error).toMatchObject({
      code: "USER_GEMINI_API_KEY_REQUIRED",
    });
    expect(job.error?.message).toContain("Gemini API 키");
  });
});
