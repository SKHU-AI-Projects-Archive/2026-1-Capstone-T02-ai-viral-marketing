import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireCsrfToken } from "@server/auth/guards";
import { findUserById, getCollections } from "@server/db";
import { createGenerationQueue, enqueueGenerationJob } from "@server/jobs/queue";
import { findJobForUser, markJobFailed, resetFailedJobForRetry, toAiJobResponse } from "@server/jobs/store";
import { aiRateLimit, checkRateLimit } from "@server/security/rateLimit";

export const runtime = "nodejs";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const rateLimit = checkRateLimit(request, aiRateLimit);
  if (!rateLimit.ok) {
    return NextResponse.json({ detail: rateLimit.detail }, { status: rateLimit.status });
  }

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }
  const csrfError = requireCsrfToken(request, auth.session);
  if (csrfError) {
    return csrfError;
  }

  const { id } = await context.params;
  const { jobsCollection, usersCollection } = await getCollections();
  const job = await findJobForUser(jobsCollection, auth.user.id, id);
  if (!job) {
    return NextResponse.json({ detail: "생성 작업을 찾을 수 없습니다." }, { status: 404 });
  }
  if (job.status !== "failed") {
    return NextResponse.json({ detail: "실패한 생성 작업만 다시 시도할 수 있습니다." }, { status: 409 });
  }

  const user = await findUserById(usersCollection, auth.user.id);
  if (!user?.geminiApiKey) {
    return NextResponse.json({ detail: "설정에서 Gemini API 키를 등록해 주세요." }, { status: 403 });
  }

  const resetJob = await resetFailedJobForRetry(jobsCollection, auth.user.id, job._id.toString());
  if (!resetJob) {
    return NextResponse.json({ detail: "생성 작업을 찾을 수 없습니다." }, { status: 404 });
  }

  try {
    await enqueueGenerationJob(createGenerationQueue(), resetJob._id.toString());
  } catch {
    await markJobFailed(jobsCollection, resetJob._id, {
      message: "생성 작업을 큐에 다시 등록하지 못했습니다. Redis 연결 상태를 확인해 주세요.",
    });
    return NextResponse.json({ detail: "생성 작업을 다시 시작하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }

  return NextResponse.json(toAiJobResponse(resetJob));
}
