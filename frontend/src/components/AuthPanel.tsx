import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import { TextInput } from "./TextInput";

export type AuthMode = "login" | "signup";

type AuthForm = {
  name: string;
  email: string;
  password: string;
};

const INITIAL_AUTH_FORM: AuthForm = {
  name: "",
  email: "",
  password: "",
};

type AuthPanelProps = {
  initialMode?: AuthMode;
  onModeChange?: (mode: AuthMode) => void;
};

export function AuthPanel({ initialMode = "login", onModeChange }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [form, setForm] = useState<AuthForm>(INITIAL_AUTH_FORM);
  const [userEmail, setUserEmail] = useState("");
  const [message, setMessage] = useState("");

  const isSignup = mode === "signup";

  useEffect(() => {
    setMode(initialMode);
    setMessage("");
  }, [initialMode]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleModeChange(nextMode: AuthMode) {
    setMode(nextMode);
    setMessage("");
    onModeChange?.(nextMode);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const email = form.email.trim();
    const name = form.name.trim();
    const password = form.password.trim();

    if (isSignup && !name) {
      setMessage("이름을 입력해 주세요.");
      return;
    }

    if (!email || !password) {
      setMessage("이메일과 비밀번호를 입력해 주세요.");
      return;
    }

    if (password.length < 6) {
      setMessage("비밀번호는 6자 이상으로 입력해 주세요.");
      return;
    }

    setUserEmail(email);
    setForm(INITIAL_AUTH_FORM);
    setMessage(isSignup ? "회원가입이 완료되었습니다." : "로그인되었습니다.");
  }

  function handleLogout() {
    setUserEmail("");
    setMessage("로그아웃되었습니다.");
  }

  return (
    <section className="auth-panel" aria-label="회원가입 및 로그인">
      <div className="auth-panel__header">
        <div>
          <p className="auth-panel__eyebrow">Account</p>
          <h2>회원가입 및 로그인</h2>
        </div>
        {userEmail ? (
          <button className="button button--secondary" type="button" onClick={handleLogout}>
            로그아웃
          </button>
        ) : null}
      </div>

      {userEmail ? (
        <p className="auth-panel__status">{userEmail} 계정으로 이용 중입니다.</p>
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
              className={`auth-panel__tab${isSignup ? " auth-panel__tab--active" : ""}`}
              type="button"
              onClick={() => handleModeChange("signup")}
            >
              회원가입
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup ? (
              <TextInput
                label="이름"
                name="name"
                type="text"
                placeholder="예: 홍길동"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
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
              placeholder="6자 이상"
              value={form.password}
              onChange={handleChange}
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
            />

            <button className="button" type="submit">
              {isSignup ? "회원가입" : "로그인"}
            </button>
          </form>
        </>
      )}

      {message ? <p className="auth-panel__message">{message}</p> : null}
    </section>
  );
}
