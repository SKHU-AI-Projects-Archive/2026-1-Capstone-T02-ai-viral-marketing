import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import { AuthPanel, AuthSubmitPayload } from "./components/AuthPanel";
import { MarketingForm } from "./components/MarketingForm";
import { ResultPanel } from "./components/ResultPanel";
import { SectionTitle } from "./components/SectionTitle";

type ResultState = "idle" | "loading" | "success" | "error";
type AuthStatus = "loading" | "authenticated" | "guest";

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

type SessionResponse = {
  authenticated: boolean;
  user?: AuthUser;
};

type FormState = {
  name: string;
  keywords: string;
  summary: string;
};

type GenerateResponse = {
  generated_text: string;
  detail?: string;
};

type ImageAnalysis = {
  recommendedKeywords: string[];
  recommendedSummary: string;
  features: Record<string, unknown>;
  detail?: string;
};

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const PROTECTED_PATHS = ["/generate", "/result"];

const INITIAL_FORM: FormState = {
  name: "",
  keywords: "",
  summary: "",
};

const INITIAL_RESULT = {
  status: "idle" as ResultState,
  content: "아직 생성된 마케팅 문구가 없습니다.",
};

export function App() {
  const navigate = useNavigate();
  const location = useLocation();

  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState(INITIAL_RESULT);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageMessage, setImageMessage] = useState("");
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);

  useEffect(() => {
    void loadSession();
  }, []);

  useEffect(() => {
    if (authStatus === "guest" && PROTECTED_PATHS.includes(location.pathname)) {
      setAuthMessage("이 페이지는 로그인 후 이용할 수 있습니다.");
      navigate("/login");
    }
  }, [authStatus, location.pathname]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  async function loadSession() {
    setAuthStatus("loading");

    try {
      const response = await fetch("/api/auth/session", {
        credentials: "include",
      });
      const data = (await response.json()) as SessionResponse;

      if (data.authenticated && data.user) {
        setAuthUser(data.user);
        setAuthStatus("authenticated");
        return;
      }
    } catch (error) {
      setAuthMessage("현재 세션 정보를 불러오지 못했습니다.");
    }

    setAuthUser(null);
    setAuthStatus("guest");
  }

  function openGeneratePage() {
    if (authStatus !== "authenticated") {
      setAuthMessage("문구 생성 페이지는 로그인 후 이용할 수 있습니다.");
      navigate("/login");
      return;
    }

    setAuthMessage("");
    navigate("/generate");
  }

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImageMessage("");
    setImageAnalysis(null);

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl("");
    }

    if (!file) {
      setImageFile(null);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageFile(null);
      setImageMessage("JPG, PNG, WEBP 형식의 이미지만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setImageFile(null);
      setImageMessage("이미지 파일은 4MB 이하만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setImageMessage("이미지를 선택했습니다. 분석 버튼을 누르면 키워드와 요약을 추천받을 수 있습니다.");
  }

  async function handleAnalyzeImage() {
    if (!imageFile) {
      setImageMessage("분석할 이미지를 먼저 선택해 주세요.");
      return;
    }

    const body = new FormData();
    body.append("file", imageFile);

    setAnalyzingImage(true);
    setImageMessage("이미지를 분석하는 중입니다.");

    try {
      const response = await fetch("/api/analyze-image", {
        method: "POST",
        body,
        credentials: "include",
      });
      const data = (await response.json()) as ImageAnalysis;

      if (response.status === 401) {
        setAuthUser(null);
        setAuthStatus("guest");
        setAuthMessage("세션이 만료되었습니다. 다시 로그인해 주세요.");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error(data.detail || "이미지 분석에 실패했습니다.");
      }

      const nextAnalysis: ImageAnalysis = {
        recommendedKeywords: data.recommendedKeywords ?? [],
        recommendedSummary: data.recommendedSummary ?? "",
        features: data.features ?? {},
      };

      setImageAnalysis(nextAnalysis);
      setForm((current) => ({
        ...current,
        keywords: nextAnalysis.recommendedKeywords.length
          ? nextAnalysis.recommendedKeywords.join(", ")
          : current.keywords,
        summary: nextAnalysis.recommendedSummary || current.summary,
      }));
      setImageMessage("이미지 분석 결과를 키워드와 제품 요약에 반영했습니다.");
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : "이미지 분석 중 예기치 않은 오류가 발생했습니다.");
    } finally {
      setAnalyzingImage(false);
    }
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
      ...(imageAnalysis ? { imageAnalysis } : {}),
    };

    if (!payload.name || !payload.keywords.length || !payload.summary) {
      setResult({
        status: "error",
        content: "마케팅 문구를 생성하려면 모든 항목을 입력해 주세요.",
      });
      navigate("/result");
      return;
    }

    setResult({
      status: "loading",
      content: "마케팅 문구를 생성하는 중입니다.",
    });
    navigate("/result");

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as GenerateResponse;

      if (response.status === 401) {
        setAuthUser(null);
        setAuthStatus("guest");
        setAuthMessage("세션이 만료되었습니다. 다시 로그인해 주세요.");
        navigate("/login");
        return;
      }

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
        content: error instanceof Error ? error.message : "문구 생성 중 예기치 않은 오류가 발생했습니다.",
      });
    }
  }

  async function handleAuthSubmit(payload: AuthSubmitPayload) {
    setAuthSubmitting(true);
    setAuthMessage("");

    try {
      const endpoint = payload.mode === "signup" ? "/api/auth/signup" : "/api/auth/login";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { detail?: string; user?: AuthUser };

      if (!response.ok || !data.user) {
        throw new Error(data.detail || "인증에 실패했습니다.");
      }

      setAuthUser(data.user);
      setAuthStatus("authenticated");
      setAuthMessage(payload.mode === "signup" ? "회원가입이 완료되었습니다. 바로 로그인되었습니다." : "로그인되었습니다.");
      navigate("/generate");
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "인증에 실패했습니다.");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setAuthUser(null);
      setAuthStatus("guest");
      setAuthMessage("로그아웃되었습니다.");
      navigate("/login");
    }
  }

  function renderHome() {
    return (
      <>
        <article className="panel panel--intro">
          <SectionTitle
            eyebrow="AI 바이럴 카피 랩"
            title="제품 정보를 마케팅 문구로 빠르게 바꿔보세요."
            description="회원가입 또는 로그인 후 보호된 작업 공간에서 문구 생성과 이미지 기반 추천 기능을 이용할 수 있습니다."
          />
        </article>

        <article className="panel home-actions">
          <button className="button" type="button" onClick={openGeneratePage}>
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

  function renderAuth(mode: "login" | "signup") {
    return (
      <article className="panel">
        <AuthPanel
          initialMode={mode}
          user={authUser}
          busy={authSubmitting}
          message={authMessage}
          onModeChange={(nextMode) => {
            setAuthMessage("");
            navigate(nextMode === "signup" ? "/signup" : "/login");
          }}
          onSubmit={handleAuthSubmit}
          onLogout={handleLogout}
        />
      </article>
    );
  }

  function renderGenerate() {
    if (authStatus === "loading") {
      return (
        <article className="panel">
          <p className="auth-panel__message">세션을 확인하는 중입니다.</p>
        </article>
      );
    }

    return (
      <article className="panel panel--workspace">
        <div className="workspace-header">
          <div>
            <p className="auth-panel__eyebrow">작업 공간</p>
            <h2 className="workspace-header__title">마케팅 문구 생성</h2>
            <p className="auth-panel__message">
              {authUser ? `${authUser.email} 계정으로 로그인되어 있습니다.` : "로그인이 필요합니다."}
            </p>
          </div>
          {authUser ? (
            <button className="button button--secondary" type="button" onClick={() => void handleLogout()}>
              로그아웃
            </button>
          ) : null}
        </div>

        <MarketingForm
          form={form}
          loading={result.status === "loading"}
          imagePreviewUrl={imagePreviewUrl}
          imageFileName={imageFile?.name ?? ""}
          imageMessage={imageMessage}
          analyzingImage={analyzingImage}
          onChange={handleChange}
          onImageChange={handleImageChange}
          onAnalyzeImage={handleAnalyzeImage}
          onSubmit={handleSubmit}
        />
      </article>
    );
  }

  function renderResult() {
    if (authStatus === "loading") {
      return (
        <article className="panel">
          <p className="auth-panel__message">세션을 확인하는 중입니다.</p>
        </article>
      );
    }

    return (
      <article className="panel panel--workspace">
        <div className="workspace-header">
          <div>
            <p className="auth-panel__eyebrow">결과</p>
            <h2 className="workspace-header__title">생성된 마케팅 문구</h2>
          </div>
          <button className="button button--secondary" type="button" onClick={() => navigate("/generate")}>
            생성 페이지로
          </button>
        </div>

        <ResultPanel status={result.status} content={result.content} />
      </article>
    );
  }

  const showResultTab = result.status !== "idle";

  return (
    <main className="page-shell">
      <div className="backdrop backdrop--one" />
      <div className="backdrop backdrop--two" />

      <section className="layout layout--single">
        <nav className="app-nav" aria-label="주요 메뉴">
          <button className="app-nav__link" type="button" onClick={() => navigate("/")}>
            홈
          </button>
          <button className="app-nav__link" type="button" onClick={openGeneratePage}>
            문구 생성
          </button>
          {showResultTab ? (
            <button className="app-nav__link" type="button" onClick={() => navigate("/result")}>
              생성 결과
            </button>
          ) : null}
          {authUser ? (
            <button className="app-nav__link app-nav__link--active" type="button" onClick={() => navigate("/generate")}>
              {authUser.name}
            </button>
          ) : (
            <>
              <button className="app-nav__link" type="button" onClick={() => navigate("/login")}>
                로그인
              </button>
              <button className="app-nav__link" type="button" onClick={() => navigate("/signup")}>
                회원가입
              </button>
            </>
          )}
        </nav>

        <Routes>
          <Route path="/" element={renderHome()} />
          <Route path="/login" element={renderAuth("login")} />
          <Route path="/signup" element={renderAuth("signup")} />
          <Route path="/generate" element={renderGenerate()} />
          <Route path="/result" element={renderResult()} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </section>
    </main>
  );
}
