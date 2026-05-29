import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  deleteGeminiKey,
  fetchGeminiKeySettings,
  saveGeminiKey,
} from "../api/settings";
import type { GeminiKeySettings } from "../api/types";
import type { AuthStatus } from "../hooks/useAuth";

type SettingsPageProps = {
  authStatus: AuthStatus;
  onSessionExpired: (message: string) => void;
};

type RequestState = "idle" | "loading" | "saving" | "deleting";

const emptySettings: GeminiKeySettings = {
  configured: false,
};

function formatDate(value?: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
}

export function SettingsPage({ authStatus, onSessionExpired }: SettingsPageProps) {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<GeminiKeySettings>(emptySettings);
  const [apiKey, setApiKey] = useState("");
  const [requestState, setRequestState] = useState<RequestState>("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (authStatus !== "authenticated") {
      return;
    }

    let cancelled = false;

    async function loadSettings() {
      setRequestState("loading");
      setMessage("");

      try {
        const { response, data } = await fetchGeminiKeySettings();
        if (cancelled) return;

        if (response.status === 401) {
          onSessionExpired("로그인이 필요합니다.");
          navigate("/login");
          return;
        }

        if (!response.ok) {
          setMessage(data.detail || "Gemini API 키 설정을 불러오지 못했습니다.");
          return;
        }

        setSettings(data);
      } catch (_error) {
        if (!cancelled) {
          setMessage("Gemini API 키 설정 조회 중 오류가 발생했습니다.");
        }
      } finally {
        if (!cancelled) {
          setRequestState("idle");
        }
      }
    }

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [authStatus, navigate, onSessionExpired]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedApiKey = apiKey.trim();
    if (!trimmedApiKey) {
      setMessage("Gemini API 키를 입력해 주세요.");
      return;
    }

    setRequestState("saving");
    setMessage("");

    try {
      const { response, data } = await saveGeminiKey(trimmedApiKey);
      if (response.status === 401) {
        onSessionExpired("로그인이 필요합니다.");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        setMessage(data.detail || "Gemini API 키를 저장하지 못했습니다.");
        return;
      }

      setSettings(data);
      setApiKey("");
      setMessage("Gemini API 키를 저장했습니다.");
    } catch (_error) {
      setMessage("Gemini API 키 저장 중 오류가 발생했습니다.");
    } finally {
      setRequestState("idle");
    }
  }

  async function handleDelete() {
    setRequestState("deleting");
    setMessage("");

    try {
      const { response, data } = await deleteGeminiKey();
      if (response.status === 401) {
        onSessionExpired("로그인이 필요합니다.");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        setMessage(data.detail || "Gemini API 키를 삭제하지 못했습니다.");
        return;
      }

      setSettings(data);
      setApiKey("");
      setMessage("Gemini API 키를 삭제했습니다.");
    } catch (_error) {
      setMessage("Gemini API 키 삭제 중 오류가 발생했습니다.");
    } finally {
      setRequestState("idle");
    }
  }

  if (authStatus !== "authenticated") {
    return (
      <article className="panel">
        <p className="auth-panel__message">세션을 확인하는 중입니다.</p>
      </article>
    );
  }

  const busy = requestState === "loading" || requestState === "saving" || requestState === "deleting";
  const updatedAt = formatDate(settings.updatedAt);
  const verifiedAt = formatDate(settings.verifiedAt);

  return (
    <article className="panel panel--workspace settings-page">
      <div className="workspace-header">
        <div>
          <p className="auth-panel__eyebrow">Settings</p>
          <h2 className="workspace-header__title">Gemini API 키 설정</h2>
          <p className="auth-panel__message">
            개인 Gemini API 키를 등록하면 문구 생성과 이미지 분석 요청에 해당 키를 사용합니다.
          </p>
        </div>
      </div>

      <section className="settings-status" aria-labelledby="gemini-key-status-title">
        <div>
          <h3 id="gemini-key-status-title">현재 상태</h3>
          <p className="settings-status__value">
            {settings.configured ? "등록됨" : "등록되지 않음"}
          </p>
        </div>
        {settings.configured && settings.keyPreview ? (
          <div>
            <span className="settings-status__label">마지막 4자리</span>
            <strong className="settings-status__preview">{settings.keyPreview}</strong>
          </div>
        ) : null}
        {updatedAt ? (
          <div>
            <span className="settings-status__label">최근 변경</span>
            <span>{updatedAt}</span>
          </div>
        ) : null}
        {verifiedAt ? (
          <div>
            <span className="settings-status__label">검증 완료</span>
            <span>{verifiedAt}</span>
          </div>
        ) : null}
      </section>

      <section className="settings-policy" aria-label="Gemini API 키 사용 정책">
        <strong>개인 키 필수</strong>
        <p>문구 생성과 이미지 분석은 설정 화면에 등록한 개인 Gemini API 키로만 실행됩니다.</p>
      </section>

      <form className="settings-form" onSubmit={(event) => void handleSave(event)}>
        <label className="field">
          <span className="field__label">Gemini API 키</span>
          <input
            className="field__control"
            type="password"
            name="apiKey"
            value={apiKey}
            autoComplete="off"
            placeholder="AIza..."
            onChange={(event) => setApiKey(event.target.value)}
          />
          <span className="field__hint">저장 후 입력값은 화면에서 즉시 지워집니다.</span>
        </label>

        <div className="settings-form__actions">
          <button className="button" type="submit" disabled={busy}>
            저장
          </button>
          <button
            className="button button--secondary"
            type="button"
            disabled={busy || !settings.configured}
            onClick={() => void handleDelete()}
          >
            삭제
          </button>
        </div>
      </form>

      {requestState === "loading" ? (
        <p className="auth-panel__message" role="status">설정을 불러오는 중입니다.</p>
      ) : null}
      {message ? (
        <p className="auth-panel__message" role="status">{message}</p>
      ) : null}
    </article>
  );
}
