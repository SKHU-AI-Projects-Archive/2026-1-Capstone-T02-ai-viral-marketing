import express = require("express");
import { Queue } from "bullmq";
import { Collection } from "mongodb";

import type {} from "../express-session";
import type { UserRecord } from "../db";
import { findUserById } from "../db";
import type { AiJobRecord } from "../jobStore";
import {
  createGenerationJob,
  findJobForUser,
  markJobFailed,
  resetFailedJobForRetry,
  toAiJobResponse,
} from "../jobStore";
import { normalizeGenerationInput, validateGenerationInput } from "../generationStore";
import { requireAuth, requireCsrfToken } from "../middleware/auth";
import { aiRateLimit } from "../middleware/rateLimit";
import { enqueueGenerationJob, type GenerationQueuePayload } from "../queues/aiQueue";

type Request = express.Request;
type Response = express.Response;

const missingUserGeminiApiKeyDetail = "설정에서 Gemini API 키를 등록해 주세요.";

export function createGenerationJobsRouter(
  jobsCollection: Collection<AiJobRecord>,
  generationQueue: Queue<GenerationQueuePayload>,
  usersCollection: Collection<UserRecord>
): express.Router {
  const router = express.Router();

  async function hasUserGeminiApiKey(userId: string): Promise<boolean> {
    const user = await findUserById(usersCollection, userId);
    return Boolean(user?.geminiApiKey);
  }

  router.post("/generation-jobs", aiRateLimit, requireAuth, requireCsrfToken, async (req: Request, res: Response) => {
    const input = normalizeGenerationInput(req.body);
    const validationError = validateGenerationInput(input);
    if (validationError) {
      res.status(400).json({ detail: validationError });
      return;
    }

    const sessionUser = req.session.user!;
    if (!(await hasUserGeminiApiKey(sessionUser.id))) {
      res.status(403).json({ detail: missingUserGeminiApiKeyDetail });
      return;
    }

    const job = await createGenerationJob(jobsCollection, sessionUser.id, input);

    try {
      await enqueueGenerationJob(generationQueue, job._id.toString());
    } catch (error) {
      console.error("[generation-jobs] enqueue failed:", error);
      await markJobFailed(jobsCollection, job._id, {
        message: "생성 작업을 큐에 등록하지 못했습니다. Redis 연결 상태를 확인해 주세요.",
      });
      res.status(503).json({ detail: "생성 작업을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요." });
      return;
    }

    res.status(202).json(toAiJobResponse(job));
  });

  router.get("/generation-jobs/:id", requireAuth, async (req: Request, res: Response) => {
    const job = await findJobForUser(jobsCollection, req.session.user!.id, String(req.params.id || ""));
    if (!job) {
      res.status(404).json({ detail: "생성 작업을 찾을 수 없습니다." });
      return;
    }

    res.json(toAiJobResponse(job));
  });

  router.post("/generation-jobs/:id/retry", aiRateLimit, requireAuth, requireCsrfToken, async (req: Request, res: Response) => {
    const sessionUser = req.session.user!;
    const job = await findJobForUser(jobsCollection, sessionUser.id, String(req.params.id || ""));
    if (!job) {
      res.status(404).json({ detail: "생성 작업을 찾을 수 없습니다." });
      return;
    }

    if (job.status !== "failed") {
      res.status(409).json({ detail: "실패한 생성 작업만 다시 시도할 수 있습니다." });
      return;
    }

    if (!(await hasUserGeminiApiKey(sessionUser.id))) {
      res.status(403).json({ detail: missingUserGeminiApiKeyDetail });
      return;
    }

    const resetJob = await resetFailedJobForRetry(jobsCollection, sessionUser.id, job._id.toString());
    if (!resetJob) {
      res.status(404).json({ detail: "생성 작업을 찾을 수 없습니다." });
      return;
    }

    try {
      await enqueueGenerationJob(generationQueue, resetJob._id.toString());
    } catch (error) {
      console.error("[generation-jobs] retry enqueue failed:", error);
      await markJobFailed(jobsCollection, resetJob._id, {
        message: "생성 작업을 큐에 다시 등록하지 못했습니다. Redis 연결 상태를 확인해 주세요.",
      });
      res.status(503).json({ detail: "생성 작업을 다시 시작하지 못했습니다. 잠시 후 다시 시도해 주세요." });
      return;
    }

    res.json(toAiJobResponse(resetJob));
  });

  return router;
}
