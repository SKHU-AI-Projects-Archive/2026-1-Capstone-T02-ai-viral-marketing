import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { fetchGenerations } from "../api/generation";
import type { GenerationListItem } from "../api/types";
import type { AuthStatus } from "../hooks/useAuth";

type ResultState = "idle" | "loading" | "success" | "error";

export function SavedGenerationsPage({ authStatus }: { authStatus: AuthStatus }) {
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
        const { response, data } = await fetchGenerations(50);

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

