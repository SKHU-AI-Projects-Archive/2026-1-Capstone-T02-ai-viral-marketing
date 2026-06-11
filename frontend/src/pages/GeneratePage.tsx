import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchGenerations } from "../api/generation";
import type { AuthUser, GenerationListItem } from "../api/types";
import { MarketingForm } from "../components/MarketingForm";
import { ResultPanel } from "../components/ResultPanel";
import type { AuthStatus } from "../hooks/useAuth";
import { useGenerationForm } from "../hooks/useGenerationForm";

type GeneratePageProps = {
  authStatus: AuthStatus;
  authUser: AuthUser | null;
  onSessionExpired: (message: string) => void;
};

export function GeneratePage({ authStatus, authUser, onSessionExpired }: GeneratePageProps) {
  const navigate = useNavigate();
  const [recentItems, setRecentItems] = useState<GenerationListItem[]>([]);
  const [recentMessage, setRecentMessage] = useState("최근 저장 결과를 불러오는 중입니다.");
  const generationForm = useGenerationForm({
    onGenerated: (id) => navigate(`/generations/${id}`),
    onSessionExpired: (message) => {
      onSessionExpired(message);
      navigate("/login");
    },
  });

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    let cancelled = false;

    async function loadRecentGenerations() {
      try {
        const { response, data } = await fetchGenerations(3);

        if (cancelled) return;

        if (!response.ok) {
          setRecentItems([]);
          setRecentMessage(data.detail || "최근 저장 결과를 불러오지 못했습니다.");
          return;
        }

        setRecentItems(data.items || []);
        setRecentMessage(data.items?.length ? "" : "아직 저장된 생성 결과가 없습니다.");
      } catch (_error) {
        if (cancelled) return;
        setRecentItems([]);
        setRecentMessage("최근 저장 결과 조회 중 오류가 발생했습니다.");
      }
    }

    void loadRecentGenerations();

    return () => {
      cancelled = true;
    };
  }, [authStatus]);

  if (authStatus === "loading") {
    return (
      <article className="panel">
        <p className="auth-panel__message">세션을 확인하는 중입니다.</p>
      </article>
    );
  }

  return (
    <article className="workspace-shell">
      <div className="workspace-header workspace-header--compact">
        <div>
          <p className="auth-panel__eyebrow">작업 공간</p>
          <h2 className="workspace-header__title">마케팅 문구 생성</h2>
          <p className="auth-panel__message">
            {authUser ? `${authUser.email} 계정으로 로그인되어 있습니다.` : "로그인이 필요합니다."}
          </p>
        </div>
      </div>

      <div className="generate-workspace">
        <section className="workspace-pane workspace-pane--form" aria-label="마케팅 문구 입력 폼">
          <MarketingForm
            form={generationForm.form}
            loading={generationForm.result.status === "loading"}
            imagePreviewUrl={generationForm.imagePreviewUrl}
            imageFileName={generationForm.imageFileName}
            imageMessage={generationForm.imageMessage}
            blogImages={generationForm.blogImages}
            blogImageMessage={generationForm.blogImageMessage}
            analyzingImage={generationForm.analyzingImage}
            uploadingBlogImages={generationForm.uploadingBlogImages}
            onChange={generationForm.handleChange}
            onToneChange={generationForm.handleToneChange}
            onImageChange={generationForm.handleImageChange}
            onRemoveBlogImage={generationForm.handleRemoveBlogImage}
            onBlogImageChange={generationForm.handleBlogImageChange}
            onBlogImageFilesChange={generationForm.handleBlogImageFilesChange}
            onAnalyzeImage={generationForm.handleAnalyzeImage}
            onSubmit={generationForm.handleSubmit}
          />
        </section>

        <aside className="workspace-pane workspace-pane--result" aria-label="생성 상태와 최근 저장 결과">
          <ResultPanel
            status={generationForm.result.status}
            content={generationForm.result.content || "제품 정보를 입력하고 문구를 생성하면 저장된 결과 상세 화면으로 이동합니다."}
          />
          {generationForm.needsGeminiKeySetupAction ? (
            <section className="settings-callout" aria-live="polite">
              <p>설정에서 Gemini API 키를 등록해 주세요.</p>
              <button className="button button--secondary" type="button" onClick={() => navigate("/settings")}>
                설정으로 이동
              </button>
            </section>
          ) : null}

          <section className="recent-panel" aria-labelledby="recent-generations-title">
            <div className="recent-panel__header">
              <div>
                <p className="auth-panel__eyebrow">최근 저장</p>
                <h3 id="recent-generations-title">최근 생성 결과</h3>
              </div>
              <button className="result__copy" type="button" onClick={() => navigate("/generations")}>
                전체 보기
              </button>
            </div>

            {recentItems.length ? (
              <div className="recent-panel__list">
                {recentItems.map((item) => (
                  <button
                    key={item.id}
                    className="recent-panel__item"
                    type="button"
                    onClick={() => navigate(`/generations/${item.id}`)}
                  >
                    <span className="saved-list__meta">{new Date(item.createdAt).toLocaleString()}</span>
                    <strong>{item.name}</strong>
                    <span>{item.preview || item.summary}</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="recent-panel__message" role="status" aria-live="polite">
                {recentMessage}
              </p>
            )}
          </section>
        </aside>
      </div>
    </article>
  );
}
