import { csrfFetch } from "./csrf";
import { readJson } from "./http";
import type { GenerateRequest, GenerationJobResponse } from "./types";

const JOB_FALLBACK: GenerationJobResponse = {
  id: "",
  type: "generation",
  status: "failed",
  result: null,
  error: {
    message: "생성 작업 응답을 읽지 못했습니다.",
  },
  attempts: 0,
  maxAttempts: 0,
  queuedAt: new Date().toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export async function createGenerationJob(
  payload: GenerateRequest
): Promise<{ response: Response; data: GenerationJobResponse }> {
  const response = await csrfFetch("/api/generation-jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await readJson<GenerationJobResponse>(response, {
    ...JOB_FALLBACK,
    detail: "생성 작업 서버 응답을 읽지 못했습니다.",
  });

  return { response, data };
}

export async function fetchGenerationJob(id: string): Promise<{ response: Response; data: GenerationJobResponse }> {
  const response = await fetch(`/api/generation-jobs/${id}`, { credentials: "include" });
  const data = await readJson<GenerationJobResponse>(response, {
    ...JOB_FALLBACK,
    id,
    detail: "생성 작업 상태 응답을 읽지 못했습니다.",
  });

  return { response, data };
}

export async function retryGenerationJob(id: string): Promise<{ response: Response; data: GenerationJobResponse }> {
  const response = await csrfFetch(`/api/generation-jobs/${id}/retry`, {
    method: "POST",
  });
  const data = await readJson<GenerationJobResponse>(response, {
    ...JOB_FALLBACK,
    id,
    detail: "생성 작업 재시도 응답을 읽지 못했습니다.",
  });

  return { response, data };
}
