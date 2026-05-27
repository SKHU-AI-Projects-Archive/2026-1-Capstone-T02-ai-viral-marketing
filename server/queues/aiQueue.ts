import { Queue } from "bullmq";
import type { JobsOptions } from "bullmq";
import type { RedisOptions } from "ioredis";

import { serverConfig } from "../config";

export type GenerationQueuePayload = {
  jobId: string;
};

const generationQueueName = "generation";

export function getRedisConnectionOptions(): RedisOptions {
  const parsed = new URL(serverConfig.redisUrl);
  const dbFromPath = parsed.pathname ? Number(parsed.pathname.replace("/", "")) : 0;

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 6379,
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    db: Number.isInteger(dbFromPath) ? dbFromPath : 0,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export function createGenerationQueue(): Queue<GenerationQueuePayload> {
  return new Queue<GenerationQueuePayload>(generationQueueName, {
    connection: getRedisConnectionOptions(),
  });
}

export async function enqueueGenerationJob(queue: Queue<GenerationQueuePayload>, jobId: string): Promise<void> {
  const options: JobsOptions = {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 2_000,
    },
    removeOnComplete: 100,
    removeOnFail: 500,
  };

  await queue.add("generate", { jobId }, options);
}

export { generationQueueName };
