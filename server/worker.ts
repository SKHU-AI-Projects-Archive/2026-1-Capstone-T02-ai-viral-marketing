import { serverConfig } from "./config";
import { connectDatabase } from "./db";
import { startGenerationWorker } from "./workers/generationWorker";

async function bootstrapWorker(): Promise<void> {
  const { generationsCollection, jobsCollection, usersCollection } = await connectDatabase(serverConfig.mongoUrl);
  const worker = startGenerationWorker(
    { generationsCollection, jobsCollection, usersCollection },
    {
      userApiKeyEncryptionSecret: serverConfig.userApiKeyEncryptionSecret,
    }
  );

  worker.on("completed", (job) => {
    console.log(`[worker] generation job completed: ${job.data.jobId}`);
  });

  worker.on("failed", (job, error) => {
    console.error(`[worker] generation job failed: ${job?.data.jobId}`, error);
  });

  console.log("[worker] generation worker running");
}

void bootstrapWorker().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
