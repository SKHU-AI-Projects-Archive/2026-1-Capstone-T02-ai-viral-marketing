import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { fetchGeneration } from "../api/generation";
import type { GenerationFetchResponse } from "../api/types";
import { ResultPanel } from "../components/ResultPanel";
import type { AuthStatus } from "../hooks/useAuth";
import { getToneLabel } from "../utils/tone";

type ResultState = "idle" | "loading" | "success" | "error";

export function SharedResultPage({ authStatus }: { authStatus: AuthStatus }) {
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
    const generationId = id;

    async function load() {
      try {
        const { response, data } = await fetchGeneration(generationId);

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
        <p className="auth-panel__message" role="status" aria-live="polite">
          {copyState === "copied" ? "복사했습니다." : "복사에 실패했습니다."}
        </p>
      ) : null}

      {meta ? (
        <section className="generation-meta" aria-label="생성 결과 메타데이터" aria-live="polite">
          <div className="generation-meta__row">
            <span className="meta-badge meta-badge--tone">{getToneLabel(meta.tone)}</span>
            {meta.imageAnalysisApplied ? <span className="meta-badge">이미지 분석 반영</span> : null}
            <span className="generation-meta__date">{new Date(meta.createdAt).toLocaleString()}</span>
          </div>

          <div className="generation-meta__block">
            <h3>키워드</h3>
            <div className="keyword-list">
              {meta.keywords.map((keyword) => (
                <span key={keyword} className="keyword-chip">
                  {keyword}
                </span>
              ))}
            </div>
          </div>

          <div className="generation-meta__block">
            <h3>요약</h3>
            <p>{meta.summary}</p>
          </div>

          {meta.blogImages?.length ? (
            <div className="generation-meta__block">
              <h3>블로그 이미지</h3>
              <div className="keyword-list">
                {meta.blogImages.map((image) => (
                  <a
                    className="keyword-chip"
                    href={image.displayUrl}
                    key={image.id}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {image.label}
                  </a>
                ))}
              </div>
            </div>
          ) : null}

          <p className="generation-meta__notice">
            {meta.blogImages?.length
              ? "블로그 이미지 URL이 생성 결과에 삽입되었습니다. 원본 이미지는 서버에 저장하지 않고 Cloudinary 공개 URL만 보관합니다."
              : meta.imageAnalysisApplied
              ? "이미지 분석 결과가 문구 생성에 반영되었습니다. 업로드한 원본 이미지는 저장하지 않습니다."
              : "업로드한 원본 이미지는 저장하지 않습니다. 이 결과에는 저장된 텍스트 정보만 보관됩니다."}
          </p>
        </section>
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
