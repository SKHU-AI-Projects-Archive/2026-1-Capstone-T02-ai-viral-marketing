import { csrfFetch } from "./csrf";
import { readJson } from "./http";
import type {
  GenerateRequest,
  GenerateResponse,
  GenerationFetchResponse,
  GenerationListResponse,
} from "./types";

export async function generateCopy(payload: GenerateRequest): Promise<{ response: Response; data: GenerateResponse }> {
  const response = await csrfFetch("/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await readJson<GenerateResponse>(response, {
    generated_text: "",
    detail: "문구 생성 서버 응답을 읽지 못했습니다.",
  });

  return { response, data };
}

export async function fetchGeneration(id: string): Promise<{ response: Response; data: GenerationFetchResponse }> {
  const response = await fetch(`/api/generations/${id}`, { credentials: "include" });
  const data = await readJson<GenerationFetchResponse>(response, {
    id,
    name: "",
    keywords: [],
    summary: "",
    tone: "blog",
    generated_text: "",
    createdAt: new Date().toISOString(),
    detail: "저장 결과 응답을 읽지 못했습니다.",
  });

  return { response, data };
}

export async function fetchGenerations(limit = 50): Promise<{ response: Response; data: GenerationListResponse }> {
  const response = await fetch(`/api/generations?limit=${limit}`, { credentials: "include" });
  const data = await readJson<GenerationListResponse>(response, {
    items: [],
    detail: "저장 목록 응답을 읽지 못했습니다.",
  });

  return { response, data };
}
