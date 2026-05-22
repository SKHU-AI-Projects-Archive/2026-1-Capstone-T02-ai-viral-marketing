import { csrfFetch, resetCsrfToken } from "./csrf";
import type { AuthSubmitRequest, AuthSubmitResponse, SessionResponse } from "./types";

export async function fetchSession(): Promise<SessionResponse> {
  const response = await fetch("/api/auth/session", {
    credentials: "include",
  });
  return (await response.json()) as SessionResponse;
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
  const data = (await response.json()) as AuthSubmitResponse;

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

