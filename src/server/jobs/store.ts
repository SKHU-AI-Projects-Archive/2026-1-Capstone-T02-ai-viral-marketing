import { Collection, ObjectId, WithId } from "mongodb";

import type { GenerationInput } from "../generations/store";

export type AiJobType = "generation" | "image_analysis";
export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type AiJobError = {
  code?: string;
  message: string;
};

export type GenerationJobInput = GenerationInput;

export type GenerationJobResult = {
  generationId: string;
  generated_text: string;
};

export type AiJobRecord = {
  userId: ObjectId;
  type: AiJobType;
  status: JobStatus;
  input: unknown;
  result: unknown | null;
  error: AiJobError | null;
  attempts: number;
  maxAttempts: number;
  generationId?: ObjectId;
  queuedAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

export type AiJobResponse = {
  id: string;
  type: AiJobType;
  status: JobStatus;
  input?: unknown;
  result: unknown | null;
  error: AiJobError | null;
  attempts: number;
  maxAttempts: number;
  generationId?: string;
  queuedAt: Date;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
};

const DEFAULT_MAX_ATTEMPTS = 3;
const JOB_TTL_SECONDS = 60 * 60 * 24 * 7;

export async function ensureJobIndexes(collection: Collection<AiJobRecord>): Promise<void> {
  await collection.createIndex({ userId: 1, createdAt: -1 });
  await collection.createIndex({ userId: 1, type: 1, createdAt: -1 });
  await collection.createIndex({ status: 1, updatedAt: 1 });
  await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: JOB_TTL_SECONDS });
}

export async function createGenerationJob(
  collection: Collection<AiJobRecord>,
  userId: string,
  input: GenerationJobInput
): Promise<WithId<AiJobRecord>> {
  const now = new Date();
  const document: AiJobRecord = {
    userId: new ObjectId(userId),
    type: "generation",
    status: "queued",
    input,
    result: null,
    error: null,
    attempts: 0,
    maxAttempts: DEFAULT_MAX_ATTEMPTS,
    queuedAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const insertResult = await collection.insertOne(document);
  return {
    _id: insertResult.insertedId,
    ...document,
  };
}

export async function findJobById(collection: Collection<AiJobRecord>, jobId: string): Promise<WithId<AiJobRecord> | null> {
  if (!ObjectId.isValid(jobId)) {
    return null;
  }

  return collection.findOne({ _id: new ObjectId(jobId) });
}

export async function findJobForUser(
  collection: Collection<AiJobRecord>,
  userId: string,
  jobId: string
): Promise<WithId<AiJobRecord> | null> {
  if (!ObjectId.isValid(jobId)) {
    return null;
  }

  return collection.findOne({
    _id: new ObjectId(jobId),
    userId: new ObjectId(userId),
  });
}

export async function markJobRunning(collection: Collection<AiJobRecord>, jobId: ObjectId, attempts: number): Promise<void> {
  const now = new Date();
  await collection.updateOne(
    { _id: jobId },
    {
      $set: {
        status: "running",
        attempts,
        error: null,
        startedAt: now,
        updatedAt: now,
      },
      $unset: {
        finishedAt: "",
      },
    }
  );
}

export async function markJobSucceeded(
  collection: Collection<AiJobRecord>,
  jobId: ObjectId,
  result: GenerationJobResult,
  generationId: ObjectId
): Promise<void> {
  const now = new Date();
  await collection.updateOne(
    { _id: jobId },
    {
      $set: {
        status: "succeeded",
        result,
        error: null,
        generationId,
        finishedAt: now,
        updatedAt: now,
      },
    }
  );
}

export async function markJobFailed(collection: Collection<AiJobRecord>, jobId: ObjectId, error: AiJobError): Promise<void> {
  const now = new Date();
  await collection.updateOne(
    { _id: jobId },
    {
      $set: {
        status: "failed",
        result: null,
        error,
        finishedAt: now,
        updatedAt: now,
      },
    }
  );
}

export async function resetFailedJobForRetry(
  collection: Collection<AiJobRecord>,
  userId: string,
  jobId: string
): Promise<WithId<AiJobRecord> | null> {
  if (!ObjectId.isValid(jobId)) {
    return null;
  }

  const now = new Date();
  const objectId = new ObjectId(jobId);
  await collection.updateOne(
    {
      _id: objectId,
      userId: new ObjectId(userId),
      status: "failed",
    },
    {
      $set: {
        status: "queued",
        result: null,
        error: null,
        attempts: 0,
        queuedAt: now,
        updatedAt: now,
      },
      $unset: {
        startedAt: "",
        finishedAt: "",
        generationId: "",
      },
    }
  );

  return collection.findOne({ _id: objectId, userId: new ObjectId(userId) });
}

export function toAiJobResponse(record: WithId<AiJobRecord>): AiJobResponse {
  return {
    id: record._id.toString(),
    type: record.type,
    status: record.status,
    input: record.input,
    result: record.result,
    error: record.error,
    attempts: record.attempts,
    maxAttempts: record.maxAttempts,
    ...(record.generationId ? { generationId: record.generationId.toString() } : {}),
    queuedAt: record.queuedAt,
    startedAt: record.startedAt,
    finishedAt: record.finishedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}
