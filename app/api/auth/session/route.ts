import { NextRequest, NextResponse } from "next/server";

import { loadSession } from "@server/auth/session";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await loadSession(request);
  if (!session.data.user) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    user: session.data.user,
  });
}
