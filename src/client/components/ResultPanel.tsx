import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type ResultState = "idle" | "loading" | "success" | "error";

type ResultPanelProps = {
  status: ResultState;
  content: string;
  imageUrl?: string;
  copyLabel?: string;
  onCopy?: () => void;
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

const PLACEHOLDER_PATTERN = /image:\/\/[^)\s]+/g;
const PLACEHOLDER_LINE_PATTERN = /^!\[[^\]]*\]\(image:\/\/[^)]+\)\s*$/gm;

function substituteImages(markdown: string, imageUrl?: string): string {
  if (!imageUrl) {
    return markdown.replace(PLACEHOLDER_LINE_PATTERN, "");
  }
  return markdown.replace(PLACEHOLDER_PATTERN, imageUrl);
}

function safeUrl(url: string): string {
  const trimmedUrl = url.trim();
  if (!trimmedUrl) {
    return "";
  }

  if (trimmedUrl.startsWith("blob:http://") || trimmedUrl.startsWith("blob:https://")) {
    return trimmedUrl;
  }

  try {
    const parsedUrl = new URL(trimmedUrl);
    return ["http:", "https:", "mailto:"].includes(parsedUrl.protocol) ? trimmedUrl : "";
  } catch (_error) {
    return "";
  }
}

export function ResultPanel({ status, content, imageUrl, copyLabel = "복사", onCopy }: ResultPanelProps) {
  const isMarkdown = status === "success";
  const rendered = isMarkdown ? substituteImages(content, imageUrl) : content;
  const liveRole = status === "error" ? "alert" : status === "loading" ? "status" : undefined;

  return (
    <section className={`result result--${status}`} role={liveRole} aria-live="polite">
      <div className="result__header">
        <h2>{TITLE_MAP[status]}</h2>
        <div className="result__tools">
          {onCopy ? (
            <button className="result__copy" type="button" onClick={onCopy}>
              {copyLabel}
            </button>
          ) : null}
          <span className="result__badge">{BADGE_MAP[status]}</span>
        </div>
      </div>
      <div className="result__body">
        {isMarkdown ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]} urlTransform={safeUrl}>
            {rendered}
          </ReactMarkdown>
        ) : (
          <p>{rendered}</p>
        )}
      </div>
    </section>
  );
}
