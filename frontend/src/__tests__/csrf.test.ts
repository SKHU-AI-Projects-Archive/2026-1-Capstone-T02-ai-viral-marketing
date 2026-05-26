import { afterEach, describe, expect, it, vi } from "vitest";

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
  vi.resetModules();
});

describe("csrfFetch", () => {
  it("refreshes the CSRF token and retries once after a stale-token 403", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ csrfToken: "old-token" }))
      .mockResolvedValueOnce(jsonResponse({ detail: "stale token" }, 403))
      .mockResolvedValueOnce(jsonResponse({ csrfToken: "new-token" }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));

    vi.stubGlobal("fetch", fetchMock);
    const { csrfFetch } = await import("../api/csrf");

    const response = await csrfFetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: "user@example.com", password: "secret123" }),
    });

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/csrf-token", { credentials: "include" });
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("X-CSRF-Token")).toBe("old-token");
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/csrf-token", { credentials: "include" });
    expect(new Headers(fetchMock.mock.calls[3][1]?.headers).get("X-CSRF-Token")).toBe("new-token");
  });
});
