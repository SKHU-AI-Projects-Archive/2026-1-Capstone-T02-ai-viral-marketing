import { csrfFetch, resetCsrfToken } from "./csrf";
import { readJson } from "./http";
import type { AuthSubmitRequest, AuthSubmitResponse, SessionResponse } from "./types";

export async function fetchSession(): Promise<SessionResponse> {
  const response = await fetch("/api/auth/session", {
    credentials: "include",
  });
  return readJson<SessionResponse>(response, { authenticated: false });
}

export async function submitAuth(payload: AuthSubmitRequest): Promise<{ response: Response; data: AuthSubmitResponse }> {
  const endpoint = payload.mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
  const response = await csrfFetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await readJson<AuthSubmitResponse>(response, {
    detail: "인증 서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.",
  });

  if (response.ok && data.user) {
    resetCsrfToken();
  }

  return { response, data };
}

export async function logout(): Promise<void> {
  try {
    await csrfFetch("/api/auth/logout", {
      method: "POST",
    });
  } finally {
    resetCsrfToken();
  }
}
