import { Worker } from "bullmq";
import { Collection } from "mongodb";

import { generateMarketingText } from "../ai/generation";
import type { GenerationExampleRecord } from "../ai/examples/store";
import type { UserRecord } from "../db";
import { findUserById } from "../db";
import type { GenerationRecord } from "../generations/store";
import { saveGeneratedArticle } from "../generations/store";
import type { AiJobRecord, GenerationJobInput } from "./store";
import { findJobById, markJobFailed, markJobRunning, markJobSucceeded } from "./store";
import { generationQueueName, getRedisConnectionOptions, type GenerationQueuePayload } from "./queue";
import { decryptGeminiApiKeyForRequest } from "../security/apiKeyCrypto";

type GenerationWorkerCollections = {
  jobsCollection: Collection<AiJobRecord>;
  generationsCollection: Collection<GenerationRecord>;
  usersCollection: Collection<UserRecord>;
  generationExamplesCollection: Collection<GenerationExampleRecord>;
};

type GenerationWorkerOptions = {
  userApiKeyEncryptionSecret: string | null;
};

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
        message: "설정에서 Gemini API 키를 등록해 주세요.",
      });
      return;
    }

    if (!options.userApiKeyEncryptionSecret) {
      await markJobFailed(collections.jobsCollection, jobRecord._id, {
        code: "USER_API_KEY_ENCRYPTION_SECRET_MISSING",
        message: "사용자 Gemini API 키를 복호화할 수 없습니다. USER_API_KEY_ENCRYPTION_SECRET 설정을 확인해 주세요.",
      });
      return;
    }

    const apiKeyOverride = decryptGeminiApiKeyForRequest(
      userGeminiApiKey,
      options.userApiKeyEncryptionSecret,
      jobRecord.userId.toString()
    );
    const generatedText = await generateMarketingText({
      input,
      userId: jobRecord.userId.toString(),
      apiKeyOverride,
      examplesCollection: collections.generationExamplesCollection,
    });
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
      await markJobFailed(collections.jobsCollection, jobRecord._id, { message });
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
