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
  const name = String(body.name || "").trim();
  const email = normalizeEmail(body.email);
  const password = String(body.password || "");

  if (!name) {
    return NextResponse.json({ detail: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (!email) {
    return NextResponse.json({ detail: "이메일을 입력해 주세요." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ detail: "비밀번호는 6자 이상이어야 합니다." }, { status: 400 });
  }

  try {
    const { usersCollection } = await getCollections();
    const existingUser = await usersCollection.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ detail: "이미 가입된 이메일입니다." }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const createdAt = new Date();
    const insertResult = await usersCollection.insertOne({ name, email, passwordHash, createdAt });
    const user = sanitizeUser({ _id: insertResult.insertedId, name, email, passwordHash, createdAt });

    await regenerateSession(session);
    session.data.user = user;

    return commitSession(
      NextResponse.json(
        {
          detail: "회원가입이 완료되었습니다.",
          user,
        },
        { status: 201 }
      ),
      session
    );
  } catch (error) {
    if (String((error as Error)?.message || "").includes("E11000")) {
      return NextResponse.json({ detail: "이미 가입된 이메일입니다." }, { status: 409 });
    }
    return NextResponse.json({ detail: "회원가입 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
