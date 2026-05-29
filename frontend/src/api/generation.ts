import { readJson } from "./http";
import type {
  GenerationFetchResponse,
  GenerationListResponse,
} from "./types";

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
