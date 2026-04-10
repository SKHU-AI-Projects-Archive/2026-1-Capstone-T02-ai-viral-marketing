type ResultState = "idle" | "loading" | "success" | "error";

type ResultPanelProps = {
  status: ResultState;
  content: string;
};

const TITLE_MAP: Record<ResultState, string> = {
  idle: "생성 결과",
  loading: "생성 중",
  success: "생성 결과",
  error: "오류",
};

const BADGE_MAP: Record<ResultState, string> = {
  idle: "대기",
  loading: "진행 중",
  success: "완료",
  error: "오류",
};

export function ResultPanel({ status, content }: ResultPanelProps) {
  return (
    <section className={`result result--${status}`} aria-live="polite">
      <div className="result__header">
        <h2>{TITLE_MAP[status]}</h2>
        <span className="result__badge">{BADGE_MAP[status]}</span>
      </div>
      <p className="result__body">{content}</p>
    </section>
  );
}
