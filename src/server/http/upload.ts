const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

export type UploadedImageFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

export function validateImageFile(file: File | null): { ok: true; file: File } | { ok: false; status: number; detail: string } {
  if (!file) {
    return { ok: false, status: 400, detail: "이미지 파일을 업로드해 주세요." };
  }
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return { ok: false, status: 400, detail: "지원하지 않는 이미지 형식입니다. JPG, PNG, WEBP 파일만 업로드해 주세요." };
  }
  if (file.size <= 0) {
    return { ok: false, status: 400, detail: "빈 이미지 파일은 업로드할 수 없습니다." };
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, status: 413, detail: "이미지 파일은 4MB 이하만 업로드할 수 있습니다." };
  }

  return { ok: true, file };
}

export async function toUploadedImageFile(file: File): Promise<UploadedImageFile> {
  return {
    buffer: Buffer.from(await file.arrayBuffer()),
    originalname: file.name || "image",
    mimetype: file.type,
    size: file.size,
  };
}
