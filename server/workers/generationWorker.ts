import { Collection } from "mongodb";
import { Worker } from "bullmq";

import type { UserRecord } from "../db";
import { findUserById } from "../db";
import type { GenerationRecord } from "../generationStore";
import { sanitizeGeneratedTextImages, saveGeneratedArticle } from "../generationStore";
import type { AiJobRecord, GenerationJobInput } from "../jobStore";
import { findJobById, markJobFailed, markJobRunning, markJobSucceeded } from "../jobStore";
import { generationQueueName, getRedisConnectionOptions, type GenerationQueuePayload } from "../queues/aiQueue";
import { decryptGeminiApiKeyForRequest } from "../services/apiKeyCrypto";
import { postFastApiJson } from "../services/fastApiClient";

type GenerationWorkerCollections = {
  jobsCollection: Collection<AiJobRecord>;
  generationsCollection: Collection<GenerationRecord>;
  usersCollection: Collection<UserRecord>;
};

type GenerationWorkerOptions = {
  userApiKeyEncryptionSecret: string | null;
};

const missingUserGeminiApiKeyMessage = "설정에서 Gemini API 키를 등록해 주세요.";
const missingApiKeyEncryptionSecretMessage =
  "사용자 Gemini API 키를 복호화할 수 없습니다. 서버의 USER_API_KEY_ENCRYPTION_SECRET 설정을 확인해 주세요.";

async function readUpstreamError(response: globalThis.Response): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    const data = (await response.json()) as { detail?: string };
    return data.detail || "AI 생성 서버가 오류를 반환했습니다.";
  }

  const text = await response.text();
  return text || "AI 생성 서버가 예상하지 못한 응답을 반환했습니다.";
}

function toGenerationInput(value: unknown): GenerationJobInput {
  const input = value as GenerationJobInput;
  if (!input || typeof input !== "object") {
    throw new Error("생성 job 입력이 올바르지 않습니다.");
  }
  return input;
}

export async function processGenerationJob(
  collections: GenerationWorkerCollections,
  jobId: string,
  attemptNumber: number,
  options: GenerationWorkerOptions
): Promise<void> {
  const jobRecord = await findJobById(collections.jobsCollection, jobId);
  if (!jobRecord) {
    throw new Error(`생성 job을 찾을 수 없습니다: ${jobId}`);
  }

  await markJobRunning(collections.jobsCollection, jobRecord._id, attemptNumber);

  try {
    const input = toGenerationInput(jobRecord.input);
    const user = await findUserById(collections.usersCollection, jobRecord.userId);
    const userGeminiApiKey = user?.geminiApiKey;

    if (!userGeminiApiKey) {
      await markJobFailed(collections.jobsCollection, jobRecord._id, {
        code: "USER_GEMINI_API_KEY_REQUIRED",
        message: missingUserGeminiApiKeyMessage,
      });
      return;
    }

    if (!options.userApiKeyEncryptionSecret) {
      await markJobFailed(collections.jobsCollection, jobRecord._id, {
        code: "USER_API_KEY_ENCRYPTION_SECRET_MISSING",
        message: missingApiKeyEncryptionSecretMessage,
      });
      return;
    }

    const geminiApiKeyOverride = decryptGeminiApiKeyForRequest(
      userGeminiApiKey,
      options.userApiKeyEncryptionSecret,
      jobRecord.userId.toString()
    );
    const upstreamResponse = await postFastApiJson("/internal/generate", {
      ...input,
      userId: jobRecord.userId.toString(),
      geminiApiKeyOverride,
    });

    if (!upstreamResponse.ok) {
      throw new Error(await readUpstreamError(upstreamResponse));
    }

    const data = (await upstreamResponse.json()) as { generated_text?: string };
    const generatedText = sanitizeGeneratedTextImages(data.generated_text || "", input);
    if (!generatedText) {
      throw new Error("AI 생성 결과가 비어 있습니다.");
    }

    const savedGeneration = await saveGeneratedArticle(
      collections.generationsCollection,
      jobRecord.userId.toString(),
      input,
      generatedText
    );

    await markJobSucceeded(
      collections.jobsCollection,
      jobRecord._id,
      {
        generationId: savedGeneration._id.toString(),
        generated_text: generatedText,
      },
      savedGeneration._id
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "생성 job 처리 중 오류가 발생했습니다.";
    if (attemptNumber >= jobRecord.maxAttempts) {
      await markJobFailed(collections.jobsCollection, jobRecord._id, {
        message,
      });
    }
    throw error;
  }
}

export function startGenerationWorker(
  collections: GenerationWorkerCollections,
  options: GenerationWorkerOptions
): Worker<GenerationQueuePayload> {
  return new Worker<GenerationQueuePayload>(
    generationQueueName,
    async (job) => {
      await processGenerationJob(collections, job.data.jobId, job.attemptsMade + 1, options);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 2,
    }
  );
}
