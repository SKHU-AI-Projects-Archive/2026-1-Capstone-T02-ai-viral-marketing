import { useNavigate } from "react-router-dom";

import { AuthPanel, AuthSubmitPayload } from "../components/AuthPanel";
import type { AuthUser } from "../api/types";

type AuthPageProps = {
  initialMode: "login" | "signup";
  user: AuthUser | null;
  busy: boolean;
  message: string;
  onSubmit: (payload: AuthSubmitPayload) => Promise<boolean>;
  onLogout: () => Promise<void>;
  onClearMessage: () => void;
};

export function AuthPage({ initialMode, user, busy, message, onSubmit, onLogout, onClearMessage }: AuthPageProps) {
  const navigate = useNavigate();

  async function handleSubmit(payload: AuthSubmitPayload) {
    const authenticated = await onSubmit(payload);
    if (authenticated) {
      navigate("/generate");
    }
  }

  async function handleLogout() {
    await onLogout();
    navigate("/login");
  }

  return (
    <article className="panel">
      <AuthPanel
        initialMode={initialMode}
        user={user}
        busy={busy}
        message={message}
        onModeChange={(nextMode) => {
          onClearMessage();
          navigate(nextMode === "signup" ? "/signup" : "/login");
        }}
        onSubmit={handleSubmit}
        onLogout={handleLogout}
      />
    </article>
  );
}

