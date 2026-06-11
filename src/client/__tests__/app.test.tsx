import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

import { App } from "../App";
import { GeneratePage } from "../pages/GeneratePage";
import { SavedGenerationsPage } from "../pages/SavedGenerationsPage";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
    },
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/generations")) {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      if (url === "/api/auth/session") {
        return Promise.resolve(jsonResponse({ authenticated: false }));
      }
      return Promise.resolve(jsonResponse({}));
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("frontend behavior", () => {
  it("shows validation feedback when submitting an empty generation form", async () => {
    render(
      <MemoryRouter>
        <GeneratePage
          authStatus="authenticated"
          authUser={{ id: "user-1", name: "테스트", email: "tester@example.com" }}
          onSessionExpired={vi.fn()}
        />
      </MemoryRouter>
    );

    const submitButton = screen.getByRole("button", { name: "마케팅 문구 생성" });
    const form = submitButton.closest("form");
    expect(form).not.toBeNull();

    fireEvent.submit(form!);

    expect(await screen.findByText("마케팅 문구를 생성하려면 모든 항목을 입력해 주세요.")).toBeInTheDocument();
  });

  it("creates a generation job and finishes after polling succeeds", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/csrf-token") {
        return Promise.resolve(jsonResponse({ csrfToken: "token" }));
      }
      if (url === "/api/generation-jobs" && init?.method === "POST") {
        return Promise.resolve(
          jsonResponse({
            id: "job-1",
            type: "generation",
            status: "queued",
            result: null,
            error: null,
            attempts: 0,
            maxAttempts: 3,
            queuedAt: "2026-05-26T00:00:00.000Z",
            createdAt: "2026-05-26T00:00:00.000Z",
            updatedAt: "2026-05-26T00:00:00.000Z",
          }, 202)
        );
      }
      if (url === "/api/generation-jobs/job-1") {
        return Promise.resolve(
          jsonResponse({
            id: "job-1",
            type: "generation",
            status: "succeeded",
            result: {
              generationId: "generation-1",
              generated_text: "완성된 문구",
            },
            error: null,
            attempts: 1,
            maxAttempts: 3,
            queuedAt: "2026-05-26T00:00:00.000Z",
            createdAt: "2026-05-26T00:00:00.000Z",
            updatedAt: "2026-05-26T00:00:03.000Z",
          })
        );
      }
      if (url.startsWith("/api/generations")) {
        return Promise.resolve(jsonResponse({ items: [] }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(
      <MemoryRouter>
        <GeneratePage
          authStatus="authenticated"
          authUser={{ id: "user-1", name: "테스트", email: "tester@example.com" }}
          onSessionExpired={vi.fn()}
        />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByLabelText("제품명"), { target: { value: "텀블러" } });
    fireEvent.change(screen.getByPlaceholderText("예: 보온, 경량, 가성비"), { target: { value: "보온, 가성비" } });
    fireEvent.change(screen.getByPlaceholderText("예: 국내 생산 스테인리스 텀블러로 보온성이 좋은 제품"), {
      target: { value: "보온성이 좋은 텀블러" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "마케팅 문구 생성" }).closest("form")!);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/generation-jobs", expect.objectContaining({ method: "POST" }));
    });
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/api/generation-jobs/job-1", { credentials: "include" });
    });
  });

  it("redirects unauthenticated users from protected routes to login", async () => {
    render(
      <MemoryRouter initialEntries={["/generate"]}>
        <App />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByRole("heading", { name: "회원가입 및 로그인" })).toBeInTheDocument();
    });
    expect(screen.getByText("이 페이지는 로그인 후 이용할 수 있습니다.")).toBeInTheDocument();
  });

  it("renders saved generation list items from the API", async () => {
    vi.mocked(fetch).mockImplementation((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/generations")) {
        return Promise.resolve(
          jsonResponse({
            items: [
              {
                id: "generation-1",
                name: "저장 상품",
                keywords: ["보온", "가성비"],
                summary: "저장된 상품 요약",
                tone: "coupang_review",
                imageAnalysisApplied: true,
                saveSource: "auto",
                createdAt: "2026-05-26T00:00:00.000Z",
                updatedAt: "2026-05-26T00:00:00.000Z",
                preview: "저장된 생성 결과 미리보기",
              },
            ],
          })
        );
      }
      return Promise.resolve(jsonResponse({ authenticated: true }));
    });

    render(
      <MemoryRouter>
        <SavedGenerationsPage authStatus="authenticated" />
      </MemoryRouter>
    );

    expect(await screen.findByText("저장 상품")).toBeInTheDocument();
    expect(screen.getByText("쿠팡 리뷰")).toBeInTheDocument();
    expect(screen.getByText("이미지 분석 반영")).toBeInTheDocument();
    expect(screen.getByText("저장된 생성 결과 미리보기")).toBeInTheDocument();
  });
});
