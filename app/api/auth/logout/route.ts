import { NextRequest, NextResponse } from "next/server";

import { requireCsrfToken } from "@server/auth/guards";
import { clearSessionCookie, destroySession, loadSession } from "@server/auth/session";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const session = await loadSession(request);
  const csrfError = requireCsrfToken(request, session);
  if (csrfError) {
    return csrfError;
  }

  await destroySession(session);
  const response = NextResponse.json({ detail: "로그아웃되었습니다." });
  clearSessionCookie(response);
  return response;
}
