import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { requireCsrfToken } from "@server/auth/guards";
import { commitSession, loadSession, normalizeEmail, regenerateSession, sanitizeUser } from "@server/auth/session";
import { getCollections } from "@server/db";
import { authRateLimit, checkRateLimit } from "@server/security/rateLimit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, authRateLimit);
  if (!rateLimit.ok) {
    return NextResponse.json({ detail: rateLimit.detail }, { status: rateLimit.status });
  }

  const session = await loadSession(request);
  const csrfError = requireCsrfToken(request, session);
  if (csrfError) {
    return csrfError;
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");
  if (!email || !password) {
    return NextResponse.json({ detail: "이메일과 비밀번호를 입력해 주세요." }, { status: 400 });
  }

  try {
    const { usersCollection } = await getCollections();
    const userRecord = await usersCollection.findOne({ email });
    if (!userRecord || !(await bcrypt.compare(password, userRecord.passwordHash))) {
      return NextResponse.json({ detail: "이메일 또는 비밀번호가 올바르지 않습니다." }, { status: 401 });
    }

    await regenerateSession(session);
    session.data.user = sanitizeUser(userRecord);
    return commitSession(
      NextResponse.json({
        detail: "로그인되었습니다.",
        user: session.data.user,
      }),
      session
    );
  } catch {
    return NextResponse.json({ detail: "로그인 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
