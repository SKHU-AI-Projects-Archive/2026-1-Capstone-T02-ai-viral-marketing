import { ObjectId } from "mongodb";
import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireCsrfToken } from "@server/auth/guards";
import { getCollections } from "@server/db";
import { serverConfig } from "@server/config";
import { encryptGeminiApiKey, toGeminiApiKeySettingsMetadata } from "@server/security/apiKeyCrypto";
import { checkRateLimit, settingsRateLimit } from "@server/security/rateLimit";

export const runtime = "nodejs";

const MIN_GEMINI_API_KEY_LENGTH = 20;
const MAX_GEMINI_API_KEY_LENGTH = 256;

function readApiKey(body: unknown): string {
  const payload = body as { apiKey?: unknown; geminiApiKey?: unknown } | null;
  const value = payload?.apiKey ?? payload?.geminiApiKey;
  return typeof value === "string" ? value.trim() : "";
}

function isValidGeminiApiKeyInput(apiKey: string): boolean {
  if (apiKey.length < MIN_GEMINI_API_KEY_LENGTH || apiKey.length > MAX_GEMINI_API_KEY_LENGTH) {
    return false;
  }
  if (/[\s\u0000-\u001f\u007f]/u.test(apiKey)) {
    return false;
  }
  return /^[A-Za-z0-9_-]+$/.test(apiKey);
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) {
    return auth;
  }

  if (!ObjectId.isValid(auth.user.id)) {
    return NextResponse.json({ detail: "로그인이 필요합니다." }, { status: 401 });
  }

  const { usersCollection } = await getCollections();
  const user = await usersCollection.findOne({ _id: new ObjectId(auth.user.id) });
  return NextResponse.json(toGeminiApiKeySettingsMetadata(user?.geminiApiKey));
}

export async function PUT(request: NextRequest) {
  const rateLimit = checkRateLimit(request, settingsRateLimit);
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
  if (!ObjectId.isValid(auth.user.id)) {
    return NextResponse.json({ detail: "로그인이 필요합니다." }, { status: 401 });
  }
  if (!serverConfig.userApiKeyEncryptionSecret) {
    return NextResponse.json(
      { detail: "사용자 API 키 저장을 사용할 수 없습니다. USER_API_KEY_ENCRYPTION_SECRET을 설정해 주세요." },
      { status: 503 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const apiKey = readApiKey(body);
  if (!isValidGeminiApiKeyInput(apiKey)) {
    return NextResponse.json({ detail: "Gemini API 키를 올바르게 입력해 주세요." }, { status: 400 });
  }

  const { usersCollection } = await getCollections();
  const userId = new ObjectId(auth.user.id);
  const existingUser = await usersCollection.findOne({ _id: userId });
  if (!existingUser) {
    return NextResponse.json({ detail: "사용자를 찾을 수 없습니다." }, { status: 404 });
  }

  const encryptedApiKey = encryptGeminiApiKey(apiKey, serverConfig.userApiKeyEncryptionSecret, {
    existingCreatedAt: existingUser.geminiApiKey?.createdAt,
    userId: userId.toString(),
  });
  await usersCollection.updateOne({ _id: userId }, { $set: { geminiApiKey: encryptedApiKey } });

  return NextResponse.json(toGeminiApiKeySettingsMetadata(encryptedApiKey));
}

export async function DELETE(request: NextRequest) {
  const rateLimit = checkRateLimit(request, settingsRateLimit);
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
  if (!ObjectId.isValid(auth.user.id)) {
    return NextResponse.json({ detail: "로그인이 필요합니다." }, { status: 401 });
  }

  const { usersCollection } = await getCollections();
  await usersCollection.updateOne({ _id: new ObjectId(auth.user.id) }, { $unset: { geminiApiKey: "" } });
  return NextResponse.json(toGeminiApiKeySettingsMetadata());
}
