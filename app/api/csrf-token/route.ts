import { NextRequest, NextResponse } from "next/server";

import { commitSession, createCsrfToken, loadSession } from "@server/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await loadSession(request);
  if (!session.data.csrfToken) {
    session.data.csrfToken = createCsrfToken();
  }

  return commitSession(NextResponse.json({ csrfToken: session.data.csrfToken }), session);
}
