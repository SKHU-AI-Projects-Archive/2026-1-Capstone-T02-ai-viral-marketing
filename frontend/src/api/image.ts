import { csrfFetch } from "./csrf";
import type { ImageAnalysis } from "./types";

export async function analyzeImage(file: File): Promise<{ response: Response; data: ImageAnalysis }> {
  const body = new FormData();
  body.append("file", file);

  const response = await csrfFetch("/api/analyze-image", {
    method: "POST",
    body,
  });
  const data = (await response.json()) as ImageAnalysis;

  return { response, data };
}

