import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "./hooks/useAuth";
import { AuthPage } from "./pages/AuthPage";
import { GeneratePage } from "./pages/GeneratePage";
import { SavedGenerationsPage } from "./pages/SavedGenerationsPage";
import { SharedResultPage } from "./pages/SharedResultPage";

function isProtectedPath(pathname: string): boolean {
  return (
    pathname === "/generate" ||
    pathname === "/generations" ||
    pathname.startsWith("/generations/")
  );
}

function LegacyResultRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/generations/${id}` : "/generations"} replace />;
}

export function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    authStatus,
    authUser,
    authMessage,
    authSubmitting,
    setAuthMessage,
    submitCredentials,
    logout,
    markGuest,
  } = useAuth();

  useEffect(() => {
    if (authStatus === "guest" && isProtectedPath(location.pathname)) {
      setAuthMessage("이 페이지는 로그인 후 이용할 수 있습니다.");
      navigate("/login");
    }
  }, [authStatus, location.pathname, navigate, setAuthMessage]);

  function openGeneratePage() {
    if (authStatus !== "authenticated") {
      setAuthMessage("문구 생성 페이지는 로그인 후 이용할 수 있습니다.");
      navigate("/login");
      return;
    }

    setAuthMessage("");
    navigate("/generate");
  }

  async function handleNavLogout() {
    await logout();
    navigate("/login");
  }

  function navClassName(active: boolean): string {
    return `app-nav__link${active ? " app-nav__link--active" : ""}`;
  }

  const isHomeActive = location.pathname === "/";
  const isGenerateActive = location.pathname === "/generate";
  const isGenerationsActive = location.pathname === "/generations" || location.pathname.startsWith("/generations/");
  const isLoginActive = location.pathname === "/login";
  const isSignupActive = location.pathname === "/signup";

  function renderHome() {
    return (
      <div className="landing-shell">
        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero__content">
            <span className="landing-pill">AI VIRAL MARKETING WORKSPACE</span>
            <h1 id="landing-title">AI 바이럴 마케팅 문구 생성 플랫폼</h1>
            <p>
              상품 정보와 이미지 분석을 바탕으로 블로그, 쿠팡 리뷰, 커뮤니티 댓글에 맞는 카피를 생성하고 저장 결과까지 관리합니다.
            </p>
            <div className="landing-hero__actions">
              <button className="button" type="button" onClick={authUser ? openGeneratePage : () => navigate("/login")}>
                {authUser ? "문구 생성 시작" : "로그인하고 시작"}
              </button>
              <button
                className="button button--secondary landing-hero__secondary"
                type="button"
                onClick={() => navigate(authUser ? "/generations" : "/signup")}
              >
                {authUser ? "저장 글 보기" : "회원가입"}
              </button>
            </div>
            <dl className="landing-metrics" aria-label="서비스 특징">
              <div>
                <dt>3</dt>
                <dd>채널별 톤</dd>
              </div>
              <div>
                <dt>Auto</dt>
                <dd>결과 저장</dd>
              </div>
              <div>
                <dt>4MB</dt>
                <dd>이미지 분석</dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="landing-section landing-section--split" aria-label="제품 핵심 가치">
          <div>
            <p className="auth-panel__eyebrow">Marketing OS</p>
            <h2>반복 작성 시간을 줄이고 결과 관리를 표준화합니다</h2>
          </div>
          <p>
            생성 화면은 입력과 결과를 나란히 배치하고, 저장 목록은 톤과 키워드, 생성 시각을 함께 보여 줍니다. 팀 과제나 상품 실험처럼 여러 문구를 빠르게 비교해야 하는 흐름에 맞췄습니다.
          </p>
        </section>

        <section className="landing-feature-grid" aria-label="주요 기능">
          <article className="landing-feature">
            <span className="landing-feature__index">01</span>
            <h3>채널별 카피 생성</h3>
            <p>블로그형 긴 후기, 쿠팡 리뷰형 실사용 문장, 커뮤니티 댓글형 짧은 반응을 같은 입력에서 분기합니다.</p>
          </article>
          <article className="landing-feature">
            <span className="landing-feature__index">02</span>
            <h3>이미지 기반 보강</h3>
            <p>제품 이미지를 분석해 키워드와 요약을 보완합니다. 원본 이미지는 저장하지 않고 생성에 필요한 정보만 반영합니다.</p>
          </article>
          <article className="landing-feature">
            <span className="landing-feature__index">03</span>
            <h3>저장 결과 관리</h3>
            <p>자동 저장된 결과를 다시 열어 보고, 톤 배지와 키워드 메타데이터로 작성 맥락을 빠르게 파악합니다.</p>
          </article>
        </section>

        <section className="landing-cta" aria-label="현재 이용 상태">
          <div>
            <p className="auth-panel__eyebrow">Ready</p>
            <h2>{authUser ? `${authUser.name}님, 새 마케팅 문구를 생성해 보세요` : "로그인 후 워크스페이스를 시작하세요"}</h2>
            <p>
              {authUser
                ? "생성 화면에서 새 결과를 만들고 저장 목록에서 이전 결과를 이어서 확인할 수 있습니다."
                : "계정을 만들면 문구 생성, 이미지 분석, 저장 결과 조회 흐름을 사용할 수 있습니다."}
            </p>
          </div>
          <button className="button" type="button" onClick={authUser ? openGeneratePage : () => navigate("/login")}>
            {authUser ? "생성 화면으로 이동" : "로그인"}
          </button>
        </section>
      </div>
    );
  }

  return (
    <main className="page-shell">
      <div className="backdrop backdrop--one" />
      <div className="backdrop backdrop--two" />

      <section className="layout layout--single">
        <header className="top-bar">
          <nav className="app-nav" aria-label="주요 메뉴">
            <button
              className={navClassName(isHomeActive)}
              type="button"
              aria-current={isHomeActive ? "page" : undefined}
              onClick={() => navigate("/")}
            >
              홈
            </button>
            <button
              className={navClassName(isGenerateActive)}
              type="button"
              aria-current={isGenerateActive ? "page" : undefined}
              onClick={openGeneratePage}
            >
              문구 생성
            </button>
            {authUser ? (
              <button
                className={navClassName(isGenerationsActive)}
                type="button"
                aria-current={isGenerationsActive ? "page" : undefined}
                onClick={() => navigate("/generations")}
              >
                저장 글
              </button>
            ) : null}
            {!authUser ? (
              <>
                <button
                  className={navClassName(isLoginActive)}
                  type="button"
                  aria-current={isLoginActive ? "page" : undefined}
                  onClick={() => navigate("/login")}
                >
                  로그인
                </button>
                <button
                  className={navClassName(isSignupActive)}
                  type="button"
                  aria-current={isSignupActive ? "page" : undefined}
                  onClick={() => navigate("/signup")}
                >
                  회원가입
                </button>
              </>
            ) : null}
          </nav>

          {authUser ? (
            <div className="account-menu" aria-label="계정 정보">
              <span className="account-menu__user">{authUser.name}</span>
              <button className="button button--secondary account-menu__logout" type="button" onClick={() => void handleNavLogout()}>
                로그아웃
              </button>
            </div>
          ) : (
            <span className="account-menu__status">로그인 전</span>
          )}
        </header>

        <Routes>
          <Route path="/" element={renderHome()} />
          <Route
            path="/login"
            element={
              <AuthPage
                initialMode="login"
                user={authUser}
                busy={authSubmitting}
                message={authMessage}
                onSubmit={submitCredentials}
                onLogout={logout}
                onClearMessage={() => setAuthMessage("")}
              />
            }
          />
          <Route
            path="/signup"
            element={
              <AuthPage
                initialMode="signup"
                user={authUser}
                busy={authSubmitting}
                message={authMessage}
                onSubmit={submitCredentials}
                onLogout={logout}
                onClearMessage={() => setAuthMessage("")}
              />
            }
          />
          <Route
            path="/generate"
            element={
              <GeneratePage
                authStatus={authStatus}
                authUser={authUser}
                onSessionExpired={markGuest}
              />
            }
          />
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
