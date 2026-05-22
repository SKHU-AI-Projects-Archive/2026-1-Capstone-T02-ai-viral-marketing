import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { fetchGeneration } from "../api/generation";
import type { GenerationFetchResponse } from "../api/types";
import { ResultPanel } from "../components/ResultPanel";
import type { AuthStatus } from "../hooks/useAuth";

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

