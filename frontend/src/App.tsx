import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";

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

export type Tone = "blog" | "coupang_review" | "community_comment";

type FormState = {
  name: string;
  keywords: string;
  summary: string;
  tone: Tone;
};

type GenerateResponse = {
  generated_text: string;
  id?: string;
  tone?: Tone;
  saveSource?: "auto";
  createdAt?: string;
  updatedAt?: string;
  detail?: string;
};

type GenerationFetchResponse = {
  id: string;
  name: string;
  keywords: string[];
  summary: string;
  tone: Tone;
  generated_text: string;
  saveSource?: "auto";
  createdAt: string;
  updatedAt?: string;
  detail?: string;
};

type GenerationListItem = Omit<GenerationFetchResponse, "generated_text" | "detail"> & {
  preview: string;
};

type GenerationListResponse = {
  items: GenerationListItem[];
  detail?: string;
};

type ImageAnalysis = {
  recommendedKeywords: string[];
  recommendedSummary: string;
  features: Record<string, unknown>;
  detail?: string;
};

type CsrfTokenResponse = {
  csrfToken: string;
  detail?: string;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_IMAGE_TYPE_LABEL = "JPG, PNG, WEBP";
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

function resetCsrfToken() {
  csrfTokenPromise = null;
}

async function csrfFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = await getCsrfToken();
  const headers = new Headers(init.headers);
  headers.set("X-CSRF-Token", token);

  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
  });
}

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/generate" ||
    pathname === "/generations" ||
    pathname.startsWith("/generations/")
  );
}

const INITIAL_FORM: FormState = {
  name: "",
  keywords: "",
  summary: "",
  tone: "blog",
};

const INITIAL_RESULT = {
  status: "idle" as ResultState,
  content: "",
};

function SharedResultPage({ authStatus }: { authStatus: AuthStatus }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<ResultState>("loading");
  const [content, setContent] = useState("저장된 생성 결과를 불러오는 중입니다.");
  const [meta, setMeta] = useState<GenerationFetchResponse | null>(null);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  useEffect(() => {
    if (authStatus !== "authenticated" || !id) {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const response = await fetch(`/api/generations/${id}`, { credentials: "include" });
        const data = (await response.json()) as GenerationFetchResponse;

        if (cancelled) return;

        if (!response.ok) {
          setStatus("error");
          setContent(data.detail || "저장된 생성 결과를 불러오지 못했습니다.");
          return;
        }

        setStatus("success");
        setContent(data.generated_text || "");
        setMeta(data);
        setCopyState("idle");
      } catch (_error) {
        if (cancelled) return;
        setStatus("error");
        setContent("생성 결과 조회 중 오류가 발생했습니다.");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id, authStatus]);

  if (authStatus !== "authenticated") {
    return (
      <article className="panel">
        <p className="auth-panel__message">세션을 확인하는 중입니다.</p>
      </article>
    );
  }

  async function handleCopyResult() {
    try {
      await navigator.clipboard.writeText(content);
      setCopyState("copied");
    } catch (_error) {
      setCopyState("error");
    }
  }

  return (
    <article className="panel panel--workspace">
      <div className="workspace-header">
        <div>
          <p className="auth-panel__eyebrow">저장 결과</p>
          <h2 className="workspace-header__title">{meta?.name || "생성된 마케팅 문구"}</h2>
          {meta?.createdAt ? (
            <p className="auth-panel__message">{new Date(meta.createdAt).toLocaleString()}</p>
          ) : null}
        </div>
        <div className="workspace-header__actions">
          <button className="button button--secondary" type="button" onClick={() => navigate("/generations")}>
            저장 목록
          </button>
          <button className="button button--secondary" type="button" onClick={() => navigate("/generate")}>
            새 글 생성
          </button>
        </div>
      </div>

      {copyState !== "idle" ? (
        <p className="auth-panel__message">{copyState === "copied" ? "복사되었습니다." : "복사에 실패했습니다."}</p>
      ) : null}

      <ResultPanel
        status={status}
        content={content}
        copyLabel={copyState === "copied" ? "복사됨" : "복사"}
        onCopy={status === "success" && content ? handleCopyResult : undefined}
      />
    </article>
  );
}

function SavedGenerationsPage({ authStatus }: { authStatus: AuthStatus }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ResultState>("loading");
  const [items, setItems] = useState<GenerationListItem[]>([]);
  const [message, setMessage] = useState("저장된 생성 결과를 불러오는 중입니다.");

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/generations?limit=50", { credentials: "include" });
        const data = (await response.json()) as GenerationListResponse;

        if (cancelled) return;

        if (!response.ok) {
          setStatus("error");
          setMessage(data.detail || "저장 목록을 불러오지 못했습니다.");
          return;
        }

        setItems(data.items || []);
        setStatus("success");
        setMessage("");
      } catch (_error) {
        if (cancelled) return;
        setStatus("error");
        setMessage("저장 목록 조회 중 오류가 발생했습니다.");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  if (authStatus !== "authenticated") {
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
          <p className="auth-panel__eyebrow">저장된 글</p>
          <h2 className="workspace-header__title">내 생성 결과</h2>
          <p className="auth-panel__message">최근 저장된 생성 결과를 확인할 수 있습니다.</p>
        </div>
        <button className="button button--secondary" type="button" onClick={() => navigate("/generate")}>
          새 글 생성
        </button>
      </div>

      {status === "loading" || status === "error" ? (
        <section className={`result result--${status}`} aria-live="polite">
          <div className="result__body">
            <p>{message}</p>
          </div>
        </section>
      ) : items.length ? (
        <div className="saved-list">
          {items.map((item) => (
            <button
              key={item.id}
              className="saved-list__item"
              type="button"
              onClick={() => navigate(`/generations/${item.id}`)}
            >
              <span className="saved-list__meta">{new Date(item.createdAt).toLocaleString()}</span>
              <strong>{item.name}</strong>
              <span className="saved-list__preview">{item.preview || item.summary}</span>
              <span className="saved-list__keywords">{item.keywords.join(", ")}</span>
            </button>
          ))}
        </div>
      ) : (
        <section className="result result--idle" aria-live="polite">
          <div className="result__body">
            <p>아직 저장된 생성 결과가 없습니다.</p>
          </div>
        </section>
      )}
    </article>
  );
}

function LegacyResultRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/generations/${id}` : "/generations"} replace />;
}

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
    if (authStatus === "guest" && isProtectedPath(location.pathname)) {
      setAuthMessage("이 페이지는 로그인 후 이용할 수 있습니다.");
      navigate("/login");
    }
  }, [authStatus, location.pathname]);

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
    } catch (_error) {
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
      setImageMessage(`${ALLOWED_IMAGE_TYPE_LABEL} 형식의 이미지만 업로드할 수 있습니다.`);
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
      const response = await csrfFetch("/api/analyze-image", {
        method: "POST",
        body,
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
      tone: form.tone,
      ...(imageAnalysis ? { imageAnalysis } : {}),
    };

    if (!payload.name || !payload.keywords.length || !payload.summary) {
      setResult({
        status: "error",
        content: "마케팅 문구를 생성하려면 모든 항목을 입력해 주세요.",
      });
      return;
    }

    setResult({
      status: "loading",
      content: "마케팅 문구를 생성하는 중입니다.",
    });

    try {
      const response = await csrfFetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
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
      if (data.id) {
        navigate(`/generations/${data.id}`);
        return;
      }
      throw new Error(data.detail || "저장된 생성 결과 ID를 받지 못했습니다.");
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
      const response = await csrfFetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { detail?: string; user?: AuthUser };

      if (!response.ok || !data.user) {
        throw new Error(data.detail || "인증에 실패했습니다.");
      }

      setAuthUser(data.user);
      setAuthStatus("authenticated");
      resetCsrfToken();
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
      await csrfFetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      resetCsrfToken();
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
            eyebrow="AI 바이럴 카피"
            title="상품 정보를 마케팅 문구로 빠르게 바꿔보세요"
            description="회원가입 또는 로그인 후 문구 생성과 이미지 기반 추천 기능을 이용할 수 있습니다."
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
          onToneChange={(tone) => setForm((current) => ({ ...current, tone }))}
          onImageChange={handleImageChange}
          onAnalyzeImage={handleAnalyzeImage}
          onSubmit={handleSubmit}
        />
        {result.status === "error" ? (
          <section className="result result--error" aria-live="polite">
            <div className="result__body">
              <p>{result.content}</p>
            </div>
          </section>
        ) : null}
      </article>
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
          <button className="app-nav__link" type="button" onClick={openGeneratePage}>
            문구 생성
          </button>
          {authUser ? (
            <button className="app-nav__link" type="button" onClick={() => navigate("/generations")}>
              저장 글
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
          <Route path="/generations" element={<SavedGenerationsPage authStatus={authStatus} />} />
          <Route path="/generations/:id" element={<SharedResultPage authStatus={authStatus} />} />
          <Route path="/result" element={<LegacyResultRedirect />} />
          <Route path="/result/:id" element={<LegacyResultRedirect />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </section>
    </main>
  );
}
