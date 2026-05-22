import { csrfFetch } from "./csrf";
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
  const data = (await response.json()) as GenerateResponse;

  return { response, data };
}

export async function fetchGeneration(id: string): Promise<{ response: Response; data: GenerationFetchResponse }> {
  const response = await fetch(`/api/generations/${id}`, { credentials: "include" });
  const data = (await response.json()) as GenerationFetchResponse;

  return { response, data };
}

export async function fetchGenerations(limit = 50): Promise<{ response: Response; data: GenerationListResponse }> {
  const response = await fetch(`/api/generations?limit=${limit}`, { credentials: "include" });
  const data = (await response.json()) as GenerationListResponse;

  return { response, data };
}

