import { NextRequest, NextResponse } from "next/server";

import type { LoadedSession, SessionUser } from "./session";
import { loadSession, tokensMatch } from "./session";

export type AuthContext = {
  session: LoadedSession;
  user: SessionUser;
};

export function json(data: unknown, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export async function requireAuth(request: NextRequest): Promise<AuthContext | NextResponse> {
  const session = await loadSession(request);
  if (!session.data.user) {
    return json({ detail: "로그인이 필요합니다." }, { status: 401 });
  }

  return { session, user: session.data.user };
}

export function requireCsrfToken(request: NextRequest, session: LoadedSession): NextResponse | null {
  const expectedToken = session.data.csrfToken;
  const submittedToken = String(request.headers.get("x-csrf-token") || "");

  if (!expectedToken || !submittedToken || !tokensMatch(expectedToken, submittedToken)) {
    return json({ detail: "요청 보안 토큰이 유효하지 않습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요." }, { status: 403 });
  }

  return null;
}
