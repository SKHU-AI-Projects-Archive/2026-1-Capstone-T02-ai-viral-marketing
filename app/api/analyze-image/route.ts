import { NextRequest, NextResponse } from "next/server";

import { analyzeProductImage } from "@server/ai/imageAnalysis";
import { requireAuth, requireCsrfToken } from "@server/auth/guards";
import { serverConfig } from "@server/config";
import { findUserById, getCollections } from "@server/db";
import { toUploadedImageFile, validateImageFile } from "@server/http/upload";
import { decryptGeminiApiKeyForRequest } from "@server/security/apiKeyCrypto";
import { aiRateLimit, checkRateLimit } from "@server/security/rateLimit";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(request, aiRateLimit);
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

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const validation = validateImageFile(file instanceof File ? file : null);
  if (!validation.ok) {
    return NextResponse.json({ detail: validation.detail }, { status: validation.status });
  }

  try {
    const { usersCollection } = await getCollections();
    const user = await findUserById(usersCollection, auth.user.id);
    if (!user?.geminiApiKey) {
      return NextResponse.json({ detail: "설정에서 Gemini API 키를 등록해 주세요." }, { status: 403 });
    }
    if (!serverConfig.userApiKeyEncryptionSecret) {
      return NextResponse.json(
        { detail: "사용자 Gemini API 키를 복호화할 수 없습니다. USER_API_KEY_ENCRYPTION_SECRET 설정을 확인해 주세요." },
        { status: 503 }
      );
    }

    const uploadedFile = await toUploadedImageFile(validation.file);
    const apiKeyOverride = decryptGeminiApiKeyForRequest(user.geminiApiKey, serverConfig.userApiKeyEncryptionSecret, auth.user.id);
    const result = await analyzeProductImage({
      imageBytes: uploadedFile.buffer,
      mediaType: uploadedFile.mimetype,
      apiKeyOverride,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "이미지 분석 중 오류가 발생했습니다.";
    return NextResponse.json({ detail: message }, { status: 502 });
  }
}
