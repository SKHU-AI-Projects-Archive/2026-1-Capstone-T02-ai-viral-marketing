import { Collection } from "mongodb";
import { Worker } from "bullmq";

import type { GenerationRecord } from "../generationStore";
import { saveGeneratedArticle } from "../generationStore";
import type { AiJobRecord, GenerationJobInput } from "../jobStore";
import { findJobById, markJobFailed, markJobRunning, markJobSucceeded } from "../jobStore";
import { generationQueueName, getRedisConnectionOptions, type GenerationQueuePayload } from "../queues/aiQueue";
import { postFastApiJson } from "../services/fastApiClient";

type GenerationWorkerCollections = {
  jobsCollection: Collection<AiJobRecord>;
  generationsCollection: Collection<GenerationRecord>;
};

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
  attemptNumber: number
): Promise<void> {
  const jobRecord = await findJobById(collections.jobsCollection, jobId);
  if (!jobRecord) {
    throw new Error(`생성 job을 찾을 수 없습니다: ${jobId}`);
  }

  await markJobRunning(collections.jobsCollection, jobRecord._id, attemptNumber);

  try {
    const input = toGenerationInput(jobRecord.input);
    const upstreamResponse = await postFastApiJson("/internal/generate", {
      ...input,
      userId: jobRecord.userId.toString(),
    });

    if (!upstreamResponse.ok) {
      throw new Error(await readUpstreamError(upstreamResponse));
    }

    const data = (await upstreamResponse.json()) as { generated_text?: string };
    const generatedText = data.generated_text || "";
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

export function startGenerationWorker(collections: GenerationWorkerCollections): Worker<GenerationQueuePayload> {
  return new Worker<GenerationQueuePayload>(
    generationQueueName,
    async (job) => {
      await processGenerationJob(collections, job.data.jobId, job.attemptsMade + 1);
    },
    {
      connection: getRedisConnectionOptions(),
      concurrency: 2,
    }
  );
}
