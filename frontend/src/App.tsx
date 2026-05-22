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
                onLogout={logout}
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

