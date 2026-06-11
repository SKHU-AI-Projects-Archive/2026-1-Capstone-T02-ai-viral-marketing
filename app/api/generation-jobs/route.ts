import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireCsrfToken } from "@server/auth/guards";
import { findUserById, getCollections } from "@server/db";
import { normalizeGenerationInput, validateGenerationInput } from "@server/generations/store";
import { createGenerationJob, markJobFailed, toAiJobResponse } from "@server/jobs/store";
import { createGenerationQueue, enqueueGenerationJob } from "@server/jobs/queue";
import { aiRateLimit, checkRateLimit } from "@server/security/rateLimit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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

  const body = await request.json().catch(() => ({}));
  const input = normalizeGenerationInput(body);
  const validationError = validateGenerationInput(input);
  if (validationError) {
    return NextResponse.json({ detail: validationError }, { status: 400 });
  }

  const { jobsCollection, usersCollection } = await getCollections();
  const user = await findUserById(usersCollection, auth.user.id);
  if (!user?.geminiApiKey) {
    return NextResponse.json({ detail: "설정에서 Gemini API 키를 등록해 주세요." }, { status: 403 });
  }

  const job = await createGenerationJob(jobsCollection, auth.user.id, input);
  try {
    await enqueueGenerationJob(createGenerationQueue(), job._id.toString());
  } catch {
    await markJobFailed(jobsCollection, job._id, {
      message: "생성 작업을 큐에 등록하지 못했습니다. Redis 연결 상태를 확인해 주세요.",
    });
    return NextResponse.json({ detail: "생성 작업을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요." }, { status: 503 });
  }

  return NextResponse.json(toAiJobResponse(job), { status: 202 });
}
