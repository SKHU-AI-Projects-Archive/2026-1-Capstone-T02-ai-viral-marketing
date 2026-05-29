import { useCallback, useEffect, useState } from "react";

import { fetchSession, logout as logoutRequest, submitAuth } from "../api/auth";
import type { AuthSubmitRequest, AuthUser } from "../api/types";

export type AuthStatus = "loading" | "authenticated" | "guest";

export function useAuth() {
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authMessage, setAuthMessage] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const loadSession = useCallback(async () => {
    setAuthStatus("loading");

    try {
      const data = await fetchSession();

      if (data.authenticated && data.user) {
        setAuthUser(data.user);
        setAuthStatus("authenticated");
        return;
      }
    } catch (_error) {
      setAuthMessage("현재 세션 정보를 불러오지 못했습니다.");
    }

    setAuthUser(null);
    setAuthStatus("guest");
  }, []);

  useEffect(() => {
    void loadSession();
  }, [loadSession]);

  const submitCredentials = useCallback(async (payload: AuthSubmitRequest): Promise<boolean> => {
    setAuthSubmitting(true);
    setAuthMessage("");

    try {
      const { response, data } = await submitAuth(payload);

      if (!response.ok || !data.user) {
        throw new Error(data.detail || "인증에 실패했습니다.");
      }

      setAuthUser(data.user);
      setAuthStatus("authenticated");
      setAuthMessage(payload.mode === "signup" ? "회원가입이 완료되었습니다. 바로 로그인되었습니다." : "로그인되었습니다.");
      return true;
    } catch (error) {
      setAuthMessage(error instanceof Error ? error.message : "인증에 실패했습니다.");
      return false;
    } finally {
      setAuthSubmitting(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setAuthUser(null);
      setAuthStatus("guest");
      setAuthMessage("로그아웃되었습니다.");
    }
  }, []);

  const markGuest = useCallback((message: string) => {
    setAuthUser(null);
    setAuthStatus("guest");
    setAuthMessage(message);
  }, []);

  return {
    authStatus,
    authUser,
    authMessage,
    authSubmitting,
    setAuthMessage,
    submitCredentials,
    logout,
    markGuest,
  };
}
