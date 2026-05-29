import { csrfFetch } from "./csrf";
import { readJson } from "./http";
import type { GeminiKeySettings } from "./types";

const GEMINI_KEY_FALLBACK: GeminiKeySettings = {
  configured: false,
  detail: "Gemini API 키 설정 응답을 읽지 못했습니다.",
};

export async function fetchGeminiKeySettings(): Promise<{ response: Response; data: GeminiKeySettings }> {
  const response = await fetch("/api/settings/gemini-key", { credentials: "include" });
  const data = await readJson<GeminiKeySettings>(response, GEMINI_KEY_FALLBACK);

  return { response, data };
}

export async function saveGeminiKey(apiKey: string): Promise<{ response: Response; data: GeminiKeySettings }> {
  const response = await csrfFetch("/api/settings/gemini-key", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ apiKey }),
  });
  const data = await readJson<GeminiKeySettings>(response, GEMINI_KEY_FALLBACK);

  return { response, data };
}

export async function deleteGeminiKey(): Promise<{ response: Response; data: GeminiKeySettings }> {
  const response = await csrfFetch("/api/settings/gemini-key", {
    method: "DELETE",
  });
  const data = await readJson<GeminiKeySettings>(response, GEMINI_KEY_FALLBACK);

  return { response, data };
}
