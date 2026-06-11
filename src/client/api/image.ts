import { csrfFetch } from "./csrf";
import { readJson } from "./http";
import type { ImageAnalysis } from "./types";

export async function analyzeImage(file: File): Promise<{ response: Response; data: ImageAnalysis }> {
  const body = new FormData();
  body.append("file", file);

  const response = await csrfFetch("/api/analyze-image", {
    method: "POST",
    body,
  });
  const data = await readJson<ImageAnalysis>(response, {
    recommendedKeywords: [],
    recommendedSummary: "",
    features: {},
    detail: "이미지 분석 서버 응답을 읽지 못했습니다.",
  });

  return { response, data };
}
