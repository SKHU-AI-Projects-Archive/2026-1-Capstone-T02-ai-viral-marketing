import { useNavigate } from "react-router-dom";

import { MarketingForm } from "../components/MarketingForm";
import type { AuthUser } from "../api/types";
import type { AuthStatus } from "../hooks/useAuth";
import { useGenerationForm } from "../hooks/useGenerationForm";

type GeneratePageProps = {
  authStatus: AuthStatus;
  authUser: AuthUser | null;
  onLogout: () => Promise<void>;
  onSessionExpired: (message: string) => void;
};

export function GeneratePage({ authStatus, authUser, onLogout, onSessionExpired }: GeneratePageProps) {
  const navigate = useNavigate();
  const generationForm = useGenerationForm({
    onGenerated: (id) => navigate(`/generations/${id}`),
    onSessionExpired: (message) => {
      onSessionExpired(message);
      navigate("/login");
    },
  });

  async function handleLogout() {
    await onLogout();
    navigate("/login");
  }

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
        form={generationForm.form}
        loading={generationForm.result.status === "loading"}
        imagePreviewUrl={generationForm.imagePreviewUrl}
        imageFileName={generationForm.imageFileName}
        imageMessage={generationForm.imageMessage}
        analyzingImage={generationForm.analyzingImage}
        onChange={generationForm.handleChange}
        onToneChange={generationForm.handleToneChange}
        onImageChange={generationForm.handleImageChange}
        onAnalyzeImage={generationForm.handleAnalyzeImage}
        onSubmit={generationForm.handleSubmit}
      />
      {generationForm.result.status === "error" ? (
        <section className="result result--error" aria-live="polite">
          <div className="result__body">
            <p>{generationForm.result.content}</p>
          </div>
        </section>
      ) : null}
    </article>
  );
}

