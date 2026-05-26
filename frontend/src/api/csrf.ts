import type { CsrfTokenResponse } from "./types";
import { readJson } from "./http";

let csrfTokenPromise: Promise<string> | null = null;

async function getCsrfToken(): Promise<string> {
  if (!csrfTokenPromise) {
    csrfTokenPromise = fetch("/api/csrf-token", { credentials: "include" })
      .then(async (response) => {
        const fallbackDetail = response.ok
          ? "요청 보안 토큰 응답을 읽지 못했습니다."
          : `요청 보안 토큰 요청이 실패했습니다. Node 인증 서버가 실행 중인지 확인해 주세요. (status: ${response.status})`;
        const data = await readJson<CsrfTokenResponse>(response, {
          csrfToken: "",
          detail: fallbackDetail,
        });
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

function withCsrfHeader(init: RequestInit, token: string): RequestInit {
  const headers = new Headers(init.headers);
  headers.set("X-CSRF-Token", token);

  return {
    ...init,
    headers,
    credentials: "include",
  };
}

export async function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await getCsrfToken();
  const response = await fetch(input, withCsrfHeader(init, token));

  if (response.status !== 403) {
    return response;
  }

  resetCsrfToken();
  const refreshedToken = await getCsrfToken();
  return fetch(input, withCsrfHeader(init, refreshedToken));
}
