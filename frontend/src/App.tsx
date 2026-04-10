import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import { AuthPanel } from "./components/AuthPanel";
import { MarketingForm } from "./components/MarketingForm";
import { ResultPanel } from "./components/ResultPanel";
import { SectionTitle } from "./components/SectionTitle";

type ResultState = "idle" | "loading" | "success" | "error";

type FormState = {
  name: string;
  keywords: string;
  summary: string;
};

type GenerateResponse = {
  generated_text: string;
};

type RoutePath = "/" | "/login" | "/signup" | "/generate";

const INITIAL_FORM: FormState = {
  name: "",
  keywords: "",
  summary: "",
};

const INITIAL_RESULT = {
  status: "idle" as ResultState,
  content: "아직 생성된 마케팅 문구가 없습니다.",
};

function getRoutePath(pathname: string): RoutePath {
  if (pathname === "/login" || pathname === "/signup" || pathname === "/generate") {
    return pathname;
  }
  return "/";
}

export function App() {
  const [route, setRoute] = useState<RoutePath>(() => getRoutePath(window.location.pathname));
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState(INITIAL_RESULT);

  useEffect(() => {
    function handlePopState() {
      setRoute(getRoutePath(window.location.pathname));
    }

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  function navigate(nextRoute: RoutePath) {
    window.history.pushState(null, "", nextRoute);
    setRoute(nextRoute);
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      keywords: form.keywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      summary: form.summary.trim(),
    };

    if (!payload.name || !payload.keywords.length || !payload.summary) {
      setResult({
        status: "error" as ResultState,
        content: "마케팅 문구를 생성하기 전에 모든 항목을 입력해 주세요.",
      });
      return;
    }

    setResult({
      status: "loading",
      content: "Gemini로 마케팅 문구를 생성하는 중입니다.",
    });

    try {
      const response = await fetch("/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as Partial<GenerateResponse> & { detail?: string };

      if (!response.ok) {
        throw new Error(data.detail || "마케팅 문구 생성에 실패했습니다.");
      }

      setResult({
        status: "success",
        content: data.generated_text || "",
      });
    } catch (error) {
      setResult({
        status: "error",
        content: error instanceof Error ? error.message : "예기치 않은 요청 오류가 발생했습니다.",
      });
    }
  }

  function renderRoute() {
    if (route === "/login" || route === "/signup") {
      return (
        <article className="panel">
          <AuthPanel
            initialMode={route === "/signup" ? "signup" : "login"}
            onModeChange={(mode) => navigate(mode === "signup" ? "/signup" : "/login")}
          />
        </article>
      );
    }

    if (route === "/generate") {
      return (
        <article className="panel panel--workspace">
          <MarketingForm
            form={form}
            loading={result.status === "loading"}
            onChange={handleChange}
            onSubmit={handleSubmit}
          />
          <ResultPanel status={result.status} content={result.content} />
        </article>
      );
    }

    return (
      <>
        <article className="panel panel--intro">
          <SectionTitle
            eyebrow="AI 바이럴 카피 랩"
            title="제품 정보를 마케팅 문구로 빠르게 변환해 보세요."
            description="제품명, 핵심 키워드, 제품 설명을 입력하면 바로 사용할 수 있는 마케팅 문구를 생성합니다."
          />
        </article>

        <article className="panel home-actions">
          <button className="button" type="button" onClick={() => navigate("/generate")}>
            문구 생성하기
          </button>
          <button className="button button--secondary" type="button" onClick={() => navigate("/login")}>
            로그인
          </button>
          <button className="button button--secondary" type="button" onClick={() => navigate("/signup")}>
            회원가입
          </button>
        </article>
      </>
    );
  }

  return (
    <main className="page-shell">
      <div className="backdrop backdrop--one" />
      <div className="backdrop backdrop--two" />

      <section className="layout layout--single">
        <nav className="app-nav" aria-label="주요 메뉴">
          <button className="app-nav__link" type="button" onClick={() => navigate("/")}>
            홈
          </button>
          <button className="app-nav__link" type="button" onClick={() => navigate("/generate")}>
            문구 생성
          </button>
          <button className="app-nav__link" type="button" onClick={() => navigate("/login")}>
            로그인
          </button>
          <button className="app-nav__link" type="button" onClick={() => navigate("/signup")}>
            회원가입
          </button>
        </nav>

        {renderRoute()}
      </section>
    </main>
  );
}
