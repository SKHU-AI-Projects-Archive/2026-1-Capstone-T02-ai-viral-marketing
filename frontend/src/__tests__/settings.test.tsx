import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("settings page", () => {
  it("renders the saved Gemini API key metadata for authenticated users", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/auth/session") {
        return Promise.resolve(
          jsonResponse({
            authenticated: true,
            user: { id: "user-1", name: "테스터", email: "tester@example.com" },
          })
        );
      }
      if (url === "/api/settings/gemini-key") {
        return Promise.resolve(
          jsonResponse({
            configured: true,
            keyPreview: "abcd",
            updatedAt: "2026-05-29T00:00:00.000Z",
          })
        );
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <App />
      </MemoryRouter>
    );

    expect(await screen.findByRole("heading", { name: "Gemini API 키 설정" })).toBeInTheDocument();
    expect(await screen.findByText("abcd")).toBeInTheDocument();
    expect(screen.getByText("등록됨")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "설정" })).toHaveAttribute("aria-current", "page");
  });

  it("clears the API key input after saving settings", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/auth/session") {
        return Promise.resolve(
          jsonResponse({
            authenticated: true,
            user: { id: "user-1", name: "테스터", email: "tester@example.com" },
          })
        );
      }
      if (url === "/api/csrf-token") {
        return Promise.resolve(jsonResponse({ csrfToken: "token" }));
      }
      if (url === "/api/settings/gemini-key" && init?.method === "PUT") {
        return Promise.resolve(
          jsonResponse({
            configured: true,
            keyPreview: "wxyz",
            updatedAt: "2026-05-29T00:00:00.000Z",
          })
        );
      }
      if (url === "/api/settings/gemini-key") {
        return Promise.resolve(jsonResponse({ configured: false }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <App />
      </MemoryRouter>
    );

    const input = (await screen.findByPlaceholderText("AIza...")) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "AIza-user-secret-wxyz" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/settings/gemini-key",
        expect.objectContaining({ method: "PUT" })
      );
    });
    await waitFor(() => {
      expect(input.value).toBe("");
    });
    expect(screen.getByText("wxyz")).toBeInTheDocument();
  });
});
