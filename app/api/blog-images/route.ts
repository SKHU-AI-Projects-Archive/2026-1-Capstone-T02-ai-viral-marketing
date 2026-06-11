import { NextRequest, NextResponse } from "next/server";

import { requireAuth, requireCsrfToken } from "@server/auth/guards";
import { serverConfig } from "@server/config";
import { toUploadedImageFile, validateImageFile } from "@server/http/upload";
import { isCloudinaryConfigured, uploadImageToCloudinary } from "@server/storage/cloudinary";
import { aiRateLimit, checkRateLimit } from "@server/security/rateLimit";

export const runtime = "nodejs";

function readTrimmedFormField(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function labelFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").trim().slice(0, 30) || "블로그 이미지";
}

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

  if (!isCloudinaryConfigured(serverConfig)) {
    return NextResponse.json(
      { detail: "Cloudinary 설정이 필요합니다. CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET을 확인해 주세요." },
      { status: 503 }
    );
  }

  try {
    const uploadedFile = await toUploadedImageFile(validation.file);
    const uploadedImage = await uploadImageToCloudinary(serverConfig, uploadedFile);
    const label = formData ? readTrimmedFormField(formData, "label") || labelFromFilename(uploadedFile.originalname) : labelFromFilename(uploadedFile.originalname);
    const description = formData ? readTrimmedFormField(formData, "description") : "";
    const placementHint = formData ? readTrimmedFormField(formData, "placementHint") : "";

    return NextResponse.json(
      {
        id: uploadedImage.cloudinaryPublicId,
        label,
        ...(description ? { description } : {}),
        ...(placementHint ? { placementHint } : {}),
        ...uploadedImage,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ detail: "Cloudinary 이미지 업로드에 실패했습니다." }, { status: 502 });
  }
}
