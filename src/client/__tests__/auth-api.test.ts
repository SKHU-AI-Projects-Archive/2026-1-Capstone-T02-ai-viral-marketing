import { afterEach, describe, expect, it, vi } from "vitest";

import { submitAuth } from "../api/auth";

function emptyResponse(status = 500): Response {
  return new Response("", { status });
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("auth API", () => {
  it("does not expose JSON parse errors when login returns an empty response", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ csrfToken: "token" }))
        .mockResolvedValueOnce(emptyResponse(500))
    );

    const { response, data } = await submitAuth({
      mode: "login",
      name: "",
      email: "user@example.com",
      password: "secret123",
    });

    expect(response.status).toBe(500);
    expect(data.detail).toBe("인증 서버 응답을 읽지 못했습니다. 잠시 후 다시 시도해 주세요.");
  });
});
