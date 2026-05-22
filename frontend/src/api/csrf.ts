import type { CsrfTokenResponse } from "./types";

let csrfTokenPromise: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch("/api/csrf-token", { credentials: "include" })
      .then(async (response) => {
        const data = (await response.json()) as CsrfTokenResponse;
        if (!response.ok || !data.csrfToken) {
          throw new Error(data.detail || "요청 보안 토큰을 발급받지 못했습니다.");
        }
        return data.csrfToken;
      })
      .catch((error) => {
        csrfTokenPromise = null;
        throw error;
      });
  }
  return csrfTokenPromise;
}

export function resetCsrfToken() {
  csrfTokenPromise = null;
}

export async function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await getCsrfToken();
  const headers = new Headers(init.headers);
  headers.set("X-CSRF-Token", token);

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}

