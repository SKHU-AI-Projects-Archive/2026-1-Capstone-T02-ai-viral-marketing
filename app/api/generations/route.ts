import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@server/auth/guards";
import { getCollections } from "@server/db";
import { listGenerationsForUser, toGenerationListItem } from "@server/generations/store";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const rawLimit = Number(request.nextUrl.searchParams.get("limit") || 20);
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 20;

  try {
    const { generationsCollection } = await getCollections();
    const records = await listGenerationsForUser(generationsCollection, auth.user.id, limit);
    return NextResponse.json({ items: records.map(toGenerationListItem) });
  } catch {
    return NextResponse.json({ detail: "생성 결과 목록 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
