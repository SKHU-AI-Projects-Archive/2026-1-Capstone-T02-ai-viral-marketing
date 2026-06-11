import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@server/auth/guards";
import { getCollections } from "@server/db";
import { findGenerationForUser, toGenerationResponse } from "@server/generations/store";

export const runtime = "nodejs";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  const { id } = await context.params;
  if (!ObjectId.isValid(id)) {
    return NextResponse.json({ detail: "잘못된 생성 결과 ID입니다." }, { status: 400 });
  }

  try {
    const { generationsCollection } = await getCollections();
    const record = await findGenerationForUser(generationsCollection, auth.user.id, id);
    if (!record) {
      return NextResponse.json({ detail: "생성 결과를 찾을 수 없습니다." }, { status: 404 });
    }
    return NextResponse.json(toGenerationResponse(record));
  } catch {
    return NextResponse.json({ detail: "생성 결과 조회 중 오류가 발생했습니다." }, { status: 500 });
  }
}
