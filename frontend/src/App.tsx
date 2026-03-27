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
  content: "No copy has been generated yet.",
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
        content: "Fill in every field before generating copy.",
      });
      return;
    }

    setResult({
      status: "loading",
      content: "Generating marketing copy with Gemini.",
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
        throw new Error(data.detail || "Failed to generate marketing copy.");
      }

      setResult({
        status: "success",
        content: data.generated_text || "",
      });
    } catch (error) {
      setResult({
        status: "error",
        content: error instanceof Error ? error.message : "An unexpected request error occurred.",
      });
    }
  }

  return (
    <main className="page-shell">
      <div className="backdrop backdrop--one" />
      <div className="backdrop backdrop--two" />

      <section className="layout">
        <article className="panel panel--intro">
          <SectionTitle
            eyebrow="AI Viral Copy Lab"
            title="Turn product notes into community-style marketing copy."
            description="The form sends structured input to the FastAPI /generate endpoint and renders the response through reusable React components."
          />

          <div className="highlights">
            <div className="highlight-card">
              <strong>Reusable UI</strong>
              <span>Input fields, the result panel, and the hero section are split into reusable pieces.</span>
            </div>
            <div className="highlight-card">
              <strong>Typed Frontend</strong>
              <span>The React app now uses TypeScript and a real build pipeline.</span>
            </div>
          </div>
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
