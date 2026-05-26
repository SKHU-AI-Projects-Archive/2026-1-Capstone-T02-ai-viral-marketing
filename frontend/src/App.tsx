import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";

import { SectionTitle } from "./components/SectionTitle";
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
      <article className="panel panel--intro">
        <SectionTitle
          eyebrow="AI 바이럴 카피"
          title="상품 정보를 마케팅 문구로 빠르게 바꿔보세요"
          description="상단 메뉴에서 문구 생성, 저장 글 확인, 로그인과 회원가입을 이용할 수 있습니다."
        />
      </article>
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
