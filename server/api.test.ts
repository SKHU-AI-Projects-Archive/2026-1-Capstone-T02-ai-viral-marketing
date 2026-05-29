/// <reference path="./express-session.d.ts" />

import bcrypt = require("bcryptjs");
import express = require("express");
import session = require("express-session");
import { ObjectId, WithId } from "mongodb";
import request = require("supertest");
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UserRecord } from "./db";
import type { GenerationRecord } from "./generationStore";
import type { AiJobRecord } from "./jobStore";
import { createAuthRouter } from "./routes/auth";
import { createGenerationRouter } from "./routes/generation";
import { createGenerationJobsRouter } from "./routes/generationJobs";
import { createImageRouter } from "./routes/image";
import { createSettingsRouter } from "./routes/settings";
import { decryptGeminiApiKey, encryptGeminiApiKey } from "./services/apiKeyCrypto";
import { postFastApiForm } from "./services/fastApiClient";

vi.mock("./services/fastApiClient", async (importActual) => {
  const actual = await importActual<typeof import("./services/fastApiClient")>();
  return {
    ...actual,
    postFastApiForm: vi.fn(),
  };
});

type UserDocument = WithId<UserRecord>;
type GenerationDocument = WithId<GenerationRecord>;
type JobDocument = WithId<AiJobRecord>;
type TestAgent = ReturnType<typeof request.agent>;
const TEST_API_KEY_SECRET = Buffer.from("12345678901234567890123456789012", "utf8").toString("base64");

class FakeUsersCollection {
  readonly records: UserDocument[] = [];

  async findOne(query: Partial<UserRecord> & { _id?: ObjectId }): Promise<UserDocument | null> {
    return (
      this.records.find((record) => {
        const sameEmail = !query.email || record.email === query.email;
        const sameId = !query._id || record._id.equals(query._id);
        return sameEmail && sameId;
      }) ?? null
    );
  }

  async insertOne(document: UserRecord): Promise<{ insertedId: ObjectId }> {
    const insertedId = new ObjectId();
    this.records.push({ ...document, _id: insertedId });
    return { insertedId };
  }

  async updateOne(
    query: Partial<UserRecord> & { _id?: ObjectId },
    update: { $set?: Partial<UserRecord>; $unset?: Record<string, string> }
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
  readonly records: GenerationDocument[] = [];

  async findOne(query: { _id?: ObjectId; userId?: ObjectId }): Promise<GenerationDocument | null> {
    return (
      this.records.find((record) => {
        const sameId = !query._id || record._id.equals(query._id);
        const sameUser = !query.userId || record.userId.equals(query.userId);
        return sameId && sameUser;
      }) ?? null
    );
  }

  find(query: { userId?: ObjectId }) {
    const records = this.records.filter((record) => !query.userId || record.userId.equals(query.userId));
    return {
      sort: () => ({
        limit: (limit: number) => ({
          toArray: async () => records.slice(0, limit),
        }),
      }),
    };
  }
}

class FakeJobsCollection {
  readonly records: JobDocument[] = [];

  async insertOne(document: AiJobRecord): Promise<{ insertedId: ObjectId }> {
    const insertedId = new ObjectId();
    this.records.push({ ...document, _id: insertedId });
    return { insertedId };
  }

  async findOne(query: { _id?: ObjectId; userId?: ObjectId; status?: string }): Promise<JobDocument | null> {
    return (
      this.records.find((record) => {
        const sameId = !query._id || record._id.equals(query._id);
        const sameUser = !query.userId || record.userId.equals(query.userId);
        const sameStatus = !query.status || record.status === query.status;
        return sameId && sameUser && sameStatus;
      }) ?? null
    );
  }

  async updateOne(
    query: { _id?: ObjectId; userId?: ObjectId; status?: string },
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

function createTestApp(
  users = new FakeUsersCollection(),
  generations = new FakeGenerationsCollection(),
  jobs = new FakeJobsCollection()
) {
  const app = express();
  const queue = {
    add: vi.fn().mockResolvedValue({}),
  };
  app.use(express.json());
  app.use(
    session({
      secret: "test-session-secret",
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use("/api", createAuthRouter(users as never));
  app.use(
    "/api",
    createGenerationJobsRouter(
      jobs as never,
      queue as never,
      users as never
    )
  );
  app.use("/api", createGenerationRouter(generations as never));
  app.use("/api", createImageRouter(users as never, TEST_API_KEY_SECRET));
  app.use("/api", createSettingsRouter(users as never, TEST_API_KEY_SECRET));
  return { app, users, generations, jobs, queue };
}

async function getCsrfToken(agent: TestAgent): Promise<string> {
  const response = await agent.get("/api/csrf-token").expect(200);
  return response.body.csrfToken;
}

async function seedUser(users: FakeUsersCollection, email: string, password = "secret123"): Promise<UserDocument> {
  const passwordHash = await bcrypt.hash(password, 4);
  const user: UserDocument = {
    _id: new ObjectId(),
    name: email.split("@")[0],
    email,
    passwordHash,
    createdAt: new Date(),
  };
  users.records.push(user);
  return user;
}

function seedGeneration(
  generations: FakeGenerationsCollection,
  userId: ObjectId,
  overrides: Partial<GenerationRecord> = {}
): GenerationDocument {
  const now = new Date("2026-05-26T00:00:00.000Z");
  const record: GenerationDocument = {
    _id: new ObjectId(),
    userId,
    name: "테스트 상품",
    keywords: ["가성비", "분위기"],
    summary: "저장 결과 테스트",
    tone: "blog",
    imageAnalysis: null,
    generatedText: "생성된 테스트 문구입니다.",
    saveSource: "auto",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  generations.records.push(record);
  return record;
}

function seedJob(jobs: FakeJobsCollection, userId: ObjectId, overrides: Partial<AiJobRecord> = {}): JobDocument {
  const now = new Date("2026-05-26T00:00:00.000Z");
  const record: JobDocument = {
    _id: new ObjectId(),
    userId,
    type: "generation",
    status: "failed",
    input: {
      name: "테스트 상품",
      keywords: ["키워드"],
      summary: "요약",
      tone: "blog",
    },
    result: null,
    error: { message: "실패" },
    attempts: 3,
    maxAttempts: 3,
    queuedAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
  jobs.records.push(record);
  return record;
}

describe("Node API", () => {
  beforeEach(() => {
    vi.mocked(postFastApiForm).mockReset();
  });

  it("validates signup input", async () => {
    const { app } = createTestApp();
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);

    const response = await agent
      .post("/api/auth/signup")
      .set("X-CSRF-Token", csrfToken)
      .send({ name: "", email: "new@example.com", password: "secret123" })
      .expect(400);

    expect(response.body.detail).toBe("이름을 입력해 주세요.");
  });

  it("returns 401 for failed login and user data for successful login", async () => {
    const { app, users } = createTestApp();
    await seedUser(users, "user@example.com", "secret123");

    const failedAgent = request.agent(app);
    const failedToken = await getCsrfToken(failedAgent);
    await failedAgent
      .post("/api/auth/login")
      .set("X-CSRF-Token", failedToken)
      .send({ email: "user@example.com", password: "wrong-password" })
      .expect(401);

    const successAgent = request.agent(app);
    const successToken = await getCsrfToken(successAgent);
    const response = await successAgent
      .post("/api/auth/login")
      .set("X-CSRF-Token", successToken)
      .send({ email: "user@example.com", password: "secret123" })
      .expect(200);

    expect(response.body.user).toMatchObject({ email: "user@example.com" });
  });

  it("stores the authenticated user's Gemini API key encrypted and never returns plaintext", async () => {
    const { app, users } = createTestApp();
    await seedUser(users, "alpha@example.com", "secret123");
    const apiKey = "AIza-test-user-secret-key";

    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);
    await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "alpha@example.com", password: "secret123" })
      .expect(200);
    const nextCsrfToken = await getCsrfToken(agent);

    const updateResponse = await agent
      .put("/api/settings/gemini-key")
      .set("X-CSRF-Token", nextCsrfToken)
      .send({ apiKey })
      .expect(200);

    expect(updateResponse.body).toMatchObject({
      configured: true,
      keyPreview: "-key",
    });
    expect(updateResponse.body).toHaveProperty("updatedAt");
    expect(updateResponse.body).not.toHaveProperty("apiKey");
    expect(updateResponse.text).not.toContain(apiKey);

    const storedUser = users.records.find((record) => record.email === "alpha@example.com");
    expect(storedUser?.geminiApiKey).toBeDefined();
    expect(storedUser?.geminiApiKey?.encryptedValue).not.toContain(apiKey);
    expect(JSON.stringify(storedUser)).not.toContain(apiKey);
    expect(decryptGeminiApiKey(storedUser!.geminiApiKey!, TEST_API_KEY_SECRET)).toBe(apiKey);

    const getResponse = await agent.get("/api/settings/gemini-key").expect(200);
    expect(getResponse.body).toMatchObject({
      configured: true,
      keyPreview: "-key",
    });
    expect(getResponse.body).not.toHaveProperty("createdAt");
    expect(getResponse.body).not.toHaveProperty("encryptedValue");
    expect(getResponse.body).not.toHaveProperty("authTag");
    expect(getResponse.text).not.toContain(apiKey);
  });

  it("rejects obviously invalid Gemini API keys", async () => {
    const { app, users } = createTestApp();
    await seedUser(users, "alpha@example.com", "secret123");

    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);
    await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "alpha@example.com", password: "secret123" })
      .expect(200);
    const nextCsrfToken = await getCsrfToken(agent);

    const response = await agent
      .put("/api/settings/gemini-key")
      .set("X-CSRF-Token", nextCsrfToken)
      .send({ apiKey: "short" })
      .expect(400);

    expect(response.body.detail).toBe("Gemini API 키를 올바르게 입력해 주세요.");
    expect(users.records[0].geminiApiKey).toBeUndefined();
  });

  it("deletes the authenticated user's Gemini API key", async () => {
    const { app, users } = createTestApp();
    const user = await seedUser(users, "alpha@example.com", "secret123");
    user.geminiApiKey = {
      encryptedValue: "encrypted",
      iv: "iv",
      authTag: "authTag",
      keyPreview: "-key",
      createdAt: new Date("2026-05-28T00:00:00.000Z"),
      updatedAt: new Date("2026-05-29T00:00:00.000Z"),
    };

    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);
    await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "alpha@example.com", password: "secret123" })
      .expect(200);
    const nextCsrfToken = await getCsrfToken(agent);

    const response = await agent
      .delete("/api/settings/gemini-key")
      .set("X-CSRF-Token", nextCsrfToken)
      .expect(200);

    expect(response.body).toMatchObject({ configured: false });
    expect(user.geminiApiKey).toBeUndefined();
  });

  it("rejects generation job creation when user Gemini API key is required but missing", async () => {
    const { app, users, queue } = createTestApp();
    await seedUser(users, "alpha@example.com", "secret123");

    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);
    await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "alpha@example.com", password: "secret123" })
      .expect(200);
    const nextCsrfToken = await getCsrfToken(agent);

    const response = await agent
      .post("/api/generation-jobs")
      .set("X-CSRF-Token", nextCsrfToken)
      .send({ name: "상품", keywords: ["키워드"], summary: "요약", tone: "blog" })
      .expect(403);

    expect(response.body.detail).toBe("설정에서 Gemini API 키를 등록해 주세요.");
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("uses the authenticated user's Gemini API key for image analysis without exposing it", async () => {
    const { app, users } = createTestApp();
    const user = await seedUser(users, "alpha@example.com", "secret123");
    const apiKey = "AIza-image-user-secret-key";
    user.geminiApiKey = encryptGeminiApiKey(apiKey, TEST_API_KEY_SECRET);
    vi.mocked(postFastApiForm).mockResolvedValue(
      new Response(
        JSON.stringify({
          recommendedKeywords: ["텀블러"],
          recommendedSummary: "보온 텀블러",
          features: {},
        }),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        }
      )
    );

    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);
    await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "alpha@example.com", password: "secret123" })
      .expect(200);
    const nextCsrfToken = await getCsrfToken(agent);

    const response = await agent
      .post("/api/analyze-image")
      .set("X-CSRF-Token", nextCsrfToken)
      .attach("file", Buffer.from("image-bytes"), {
        filename: "product.png",
        contentType: "image/png",
      })
      .expect(200);

    const formData = vi.mocked(postFastApiForm).mock.calls[0][1] as FormData;
    expect(formData.get("geminiApiKeyOverride")).toBe(apiKey);
    expect(response.text).not.toContain(apiKey);
  });

  it("rejects image analysis when user Gemini API key is required but missing", async () => {
    const { app, users } = createTestApp();
    await seedUser(users, "alpha@example.com", "secret123");

    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);
    await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "alpha@example.com", password: "secret123" })
      .expect(200);
    const nextCsrfToken = await getCsrfToken(agent);

    const response = await agent
      .post("/api/analyze-image")
      .set("X-CSRF-Token", nextCsrfToken)
      .attach("file", Buffer.from("image-bytes"), {
        filename: "product.png",
        contentType: "image/png",
      })
      .expect(403);

    expect(response.body.detail).toContain("Gemini API 키");
    expect(postFastApiForm).not.toHaveBeenCalled();
  });

  it("rejects protected generation APIs without authentication", async () => {
    const { app } = createTestApp();

    const response = await request(app).get("/api/generations").expect(401);

    expect(response.body.detail).toBe("로그인이 필요합니다.");
  });

  it("isolates saved generation results by authenticated user", async () => {
    const { app, users, generations } = createTestApp();
    const userA = await seedUser(users, "alpha@example.com", "secret123");
    const userB = await seedUser(users, "beta@example.com", "secret123");
    const ownRecord = seedGeneration(generations, userA._id, { name: "내 상품" });
    const otherRecord = seedGeneration(generations, userB._id, { name: "다른 사용자 상품" });

    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);
    await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "alpha@example.com", password: "secret123" })
      .expect(200);

    const listResponse = await agent.get("/api/generations").expect(200);
    expect(listResponse.body.items).toHaveLength(1);
    expect(listResponse.body.items[0]).toMatchObject({ id: ownRecord._id.toString(), name: "내 상품" });

    await agent.get(`/api/generations/${otherRecord._id.toString()}`).expect(404);
  });

  it("validates generation job input before enqueueing", async () => {
    const { app, users, queue } = createTestApp();
    await seedUser(users, "alpha@example.com", "secret123");
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);
    await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "alpha@example.com", password: "secret123" })
      .expect(200);
    const nextCsrfToken = await getCsrfToken(agent);

    const response = await agent
      .post("/api/generation-jobs")
      .set("X-CSRF-Token", nextCsrfToken)
      .send({ name: "", keywords: ["키워드"], summary: "요약", tone: "blog" })
      .expect(400);

    expect(response.body.detail).toBe("제품명을 입력해 주세요.");
    expect(queue.add).not.toHaveBeenCalled();
  });

  it("creates generation jobs and hides them from other users", async () => {
    const { app, users, queue } = createTestApp();
    const alphaUser = await seedUser(users, "alpha@example.com", "secret123");
    alphaUser.geminiApiKey = encryptGeminiApiKey("AIza-alpha-secret-key", TEST_API_KEY_SECRET);
    await seedUser(users, "beta@example.com", "secret123");

    const alpha = request.agent(app);
    const alphaToken = await getCsrfToken(alpha);
    await alpha
      .post("/api/auth/login")
      .set("X-CSRF-Token", alphaToken)
      .send({ email: "alpha@example.com", password: "secret123" })
      .expect(200);
    const nextAlphaToken = await getCsrfToken(alpha);

    const created = await alpha
      .post("/api/generation-jobs")
      .set("X-CSRF-Token", nextAlphaToken)
      .send({ name: "상품", keywords: ["키워드"], summary: "요약", tone: "blog" })
      .expect(202);

    expect(created.body.status).toBe("queued");
    expect(queue.add).toHaveBeenCalledTimes(1);
    await alpha.get(`/api/generation-jobs/${created.body.id}`).expect(200);

    const beta = request.agent(app);
    const betaToken = await getCsrfToken(beta);
    await beta
      .post("/api/auth/login")
      .set("X-CSRF-Token", betaToken)
      .send({ email: "beta@example.com", password: "secret123" })
      .expect(200);
    await beta.get(`/api/generation-jobs/${created.body.id}`).expect(404);
  });

  it("returns 410 for the legacy synchronous generation API", async () => {
    const { app, users } = createTestApp();
    await seedUser(users, "alpha@example.com", "secret123");

    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);
    await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "alpha@example.com", password: "secret123" })
      .expect(200);
    const nextCsrfToken = await getCsrfToken(agent);

    const response = await agent
      .post("/api/generate")
      .set("X-CSRF-Token", nextCsrfToken)
      .send({ name: "상품", keywords: ["키워드"], summary: "요약", tone: "blog" })
      .expect(410);

    expect(response.body.detail).toContain("/api/generation-jobs");
  });

  it("retries failed generation jobs", async () => {
    const { app, users, jobs, queue } = createTestApp();
    const user = await seedUser(users, "alpha@example.com", "secret123");
    user.geminiApiKey = encryptGeminiApiKey("AIza-alpha-secret-key", TEST_API_KEY_SECRET);
    const failedJob = seedJob(jobs, user._id);
    const agent = request.agent(app);
    const csrfToken = await getCsrfToken(agent);
    await agent
      .post("/api/auth/login")
      .set("X-CSRF-Token", csrfToken)
      .send({ email: "alpha@example.com", password: "secret123" })
      .expect(200);
    const nextCsrfToken = await getCsrfToken(agent);

    const response = await agent
      .post(`/api/generation-jobs/${failedJob._id.toString()}/retry`)
      .set("X-CSRF-Token", nextCsrfToken)
      .expect(200);

    expect(response.body.status).toBe("queued");
    expect(response.body.attempts).toBe(0);
    expect(queue.add).toHaveBeenCalledTimes(1);
  });
});
