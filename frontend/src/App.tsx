import { ChangeEvent, FormEvent, useState } from "react";

import { MarketingForm } from "./components/MarketingForm";
import { ResultPanel } from "./components/ResultPanel";
import { SectionTitle } from "./components/SectionTitle";

type ResultState = "idle" | "loading" | "success" | "error";

type FormState = {
  name: string;
  keywords: string;
  summary: string;
};

type GenerateResponse = {
  generated_text: string;
};

const INITIAL_FORM: FormState = {
  name: "",
  keywords: "",
  summary: "",
};

const INITIAL_RESULT = {
  status: "idle" as ResultState,
  content: "아직 생성된 마케팅 문구가 없습니다.",
};

export function App() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState(INITIAL_RESULT);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      keywords: form.keywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      summary: form.summary.trim(),
    };

    if (!payload.name || !payload.keywords.length || !payload.summary) {
      setResult({
        status: "error" as ResultState,
        content: "마케팅 문구를 생성하기 전에 모든 항목을 입력해 주세요.",
      });
      return;
    }

    setResult({
      status: "loading",
      content: "Gemini로 마케팅 문구를 생성하는 중입니다.",
    });

    try {
      const response = await fetch("/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as Partial<GenerateResponse> & { detail?: string };

      if (!response.ok) {
        throw new Error(data.detail || "마케팅 문구 생성에 실패했습니다.");
      }

      setResult({
        status: "success",
        content: data.generated_text || "",
      });
    } catch (error) {
      setResult({
        status: "error",
        content: error instanceof Error ? error.message : "예기치 않은 요청 오류가 발생했습니다.",
      });
    }
  }

  return (
    <main className="page-shell">
      <div className="backdrop backdrop--one" />
      <div className="backdrop backdrop--two" />

      <section
        className="layout"
        style={{
          display: "flex",
          flexDirection: "column",
          width: "min(820px, 100%)",
        }}
      >
        <article className="panel panel--intro">
          <SectionTitle
            eyebrow="AI 바이럴 카피 랩"
            title="제품 정보를 마케팅 문구로 빠르게 변환해 보세요."
            description="제품명, 핵심 키워드, 제품 설명을 입력하면 바로 사용할 수 있는 마케팅 문구를 생성합니다."
          />
        </article>

        <article className="panel panel--workspace">
          <MarketingForm
            form={form}
            loading={result.status === "loading"}
            onChange={handleChange}
            onSubmit={handleSubmit}
          />
          <ResultPanel status={result.status} content={result.content} />
        </article>
      </section>
    </main>
  );
}
