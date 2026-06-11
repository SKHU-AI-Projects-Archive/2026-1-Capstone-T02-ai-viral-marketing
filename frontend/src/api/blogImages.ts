import { csrfFetch } from "./csrf";
import { readJson } from "./http";
import type { BlogImage } from "./types";

const BLOG_IMAGE_FALLBACK: BlogImage & { detail?: string } = {
  id: "",
  label: "",
  sourceUrl: "",
  displayUrl: "",
  cloudinaryPublicId: "",
  detail: "블로그 이미지 업로드 응답을 읽지 못했습니다.",
};

export async function uploadBlogImage(
  file: File,
  metadata: {
    label?: string;
    description?: string;
    placementHint?: string;
  } = {}
): Promise<{ response: Response; data: BlogImage & { detail?: string } }> {
  const formData = new FormData();
  formData.append("file", file);
  if (metadata.label) {
    formData.append("label", metadata.label);
  }
  if (metadata.description) {
    formData.append("description", metadata.description);
  }
  if (metadata.placementHint) {
    formData.append("placementHint", metadata.placementHint);
  }

  const response = await csrfFetch("/api/blog-images", {
    method: "POST",
    body: formData,
  });
  const data = await readJson<BlogImage & { detail?: string }>(response, BLOG_IMAGE_FALLBACK);
  return { response, data };
}
