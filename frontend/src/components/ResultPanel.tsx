type ResultState = "idle" | "loading" | "success" | "error";

type ResultPanelProps = {
  status: ResultState;
  content: string;
};

const TITLE_MAP: Record<ResultState, string> = {
  idle: "Generated Copy",
  loading: "Generating",
  success: "Generated Copy",
  error: "Error",
};

export function ResultPanel({ status, content }: ResultPanelProps) {
  return (
    <section className={`result result--${status}`} aria-live="polite">
      <div className="result__header">
        <h2>{TITLE_MAP[status]}</h2>
        <span className="result__badge">{status.toUpperCase()}</span>
      </div>
      <p className="result__body">{content}</p>
    </section>
  );
}
