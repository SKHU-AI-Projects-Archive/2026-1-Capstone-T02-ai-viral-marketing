import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@server/auth/guards";
import { getCollections } from "@server/db";
import { findJobForUser, toAiJobResponse } from "@server/jobs/store";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  const { jobsCollection } = await getCollections();
  const job = await findJobForUser(jobsCollection, auth.user.id, id);
  if (!job) {
    return NextResponse.json({ detail: "생성 작업을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(toAiJobResponse(job));
}
