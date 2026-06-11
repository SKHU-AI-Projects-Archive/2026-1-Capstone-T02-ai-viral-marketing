import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import { TextInput } from "./TextInput";

export type AuthMode = "login" | "signup";

export type AuthSubmitPayload = {
  mode: AuthMode;
  name: string;
  email: string;
  password: string;
};

type AuthForm = {
  name: string;
  email: string;
  password: string;
};

type AuthUser = {
  id: string;
  name: string;
  email: string;
};

const INITIAL_AUTH_FORM: AuthForm = {
  name: "",
  email: "",
  password: "",
};

type AuthPanelProps = {
  initialMode?: AuthMode;
  user: AuthUser | null;
  busy: boolean;
  message: string;
  onModeChange?: (mode: AuthMode) => void;
  onSubmit: (payload: AuthSubmitPayload) => Promise<void>;
  onLogout: () => Promise<void>;
};

export function AuthPanel({
  initialMode = "login",
  user,
  busy,
  message,
  onModeChange,
  onSubmit,
  onLogout,
}: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [form, setForm] = useState<AuthForm>(INITIAL_AUTH_FORM);

  useEffect(() => {
    setMode(initialMode);
    setForm(INITIAL_AUTH_FORM);
  }, [initialMode]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleModeChange(nextMode: AuthMode) {
    setMode(nextMode);
    setForm(INITIAL_AUTH_FORM);
    onModeChange?.(nextMode);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    await onSubmit({
      mode,
      name: form.name.trim(),
      email: form.email.trim(),
      password: form.password,
    });

    setForm((current) => ({
      ...current,
      password: "",
    }));
  }

  return (
    <section className="auth-panel" aria-label="인증">
      <div className="auth-panel__header">
        <div>
          <p className="auth-panel__eyebrow">계정</p>
          <h2>{user ? "로그인 상태" : "회원가입 및 로그인"}</h2>
        </div>
        {user ? (
          <button className="button button--secondary" type="button" onClick={() => void onLogout()}>
            로그아웃
          </button>
        ) : null}
      </div>

      {user ? (
        <p className="auth-panel__status">{user.email} 계정으로 로그인되어 있습니다.</p>
      ) : (
        <>
          <div className="auth-panel__tabs" role="tablist" aria-label="인증 방식">
            <button
              className={`auth-panel__tab${mode === "login" ? " auth-panel__tab--active" : ""}`}
              type="button"
              onClick={() => handleModeChange("login")}
            >
              로그인
            </button>
            <button
              className={`auth-panel__tab${mode === "signup" ? " auth-panel__tab--active" : ""}`}
              type="button"
              onClick={() => handleModeChange("signup")}
            >
              회원가입
            </button>
          </div>

          <form className="auth-form" onSubmit={(event) => void handleSubmit(event)}>
            {mode === "signup" ? (
              <TextInput
                label="이름"
                name="name"
                type="text"
                placeholder="예: 홍길동"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
                required
              />
            ) : null}

            <TextInput
              label="이메일"
              name="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
              required
            />

            <TextInput
              label="비밀번호"
              name="password"
              type="password"
              placeholder="6자 이상 입력"
              value={form.password}
              onChange={handleChange}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              minLength={6}
              required
            />

            <button className="button" type="submit" disabled={busy}>
              {busy ? "처리 중..." : mode === "signup" ? "회원가입" : "로그인"}
            </button>
          </form>
        </>
      )}

      {message ? <p className="auth-panel__message">{message}</p> : null}
    </section>
  );
}
