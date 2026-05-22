import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import { generateCopy } from "../api/generation";
import { analyzeImage } from "../api/image";
import type { ImageAnalysis, Tone } from "../api/types";

type ResultState = "idle" | "loading" | "success" | "error";

export type FormState = {
  name: string;
  keywords: string;
  summary: string;
  tone: Tone;
};

type UseGenerationFormOptions = {
  onGenerated: (id: string) => void;
  onSessionExpired: (message: string) => void;
};

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const ALLOWED_IMAGE_TYPE_LABEL = "JPG, PNG, WEBP";

const INITIAL_FORM: FormState = {
  name: "",
  keywords: "",
  summary: "",
  tone: "blog",
};

const INITIAL_RESULT = {
  status: "idle" as ResultState,
  content: "",
};

export function useGenerationForm({ onGenerated, onSessionExpired }: UseGenerationFormOptions) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState(INITIAL_RESULT);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageMessage, setImageMessage] = useState("");
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  function handleChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  function handleToneChange(tone: Tone) {
    setForm((current) => ({ ...current, tone }));
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImageMessage("");
    setImageAnalysis(null);

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl("");
    }

    if (!file) {
      setImageFile(null);
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageFile(null);
      setImageMessage(`${ALLOWED_IMAGE_TYPE_LABEL} 형식의 이미지만 업로드할 수 있습니다.`);
      event.target.value = "";
      return;
    }

    if (file.size > MAX_IMAGE_BYTES) {
      setImageFile(null);
      setImageMessage("이미지 파일은 4MB 이하만 업로드할 수 있습니다.");
      event.target.value = "";
      return;
    }

    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setImageMessage("이미지를 선택했습니다. 분석 버튼을 누르면 키워드와 요약을 추천받을 수 있습니다.");
  }

  async function handleAnalyzeImage() {
    if (!imageFile) {
      setImageMessage("분석할 이미지를 먼저 선택해 주세요.");
      return;
    }

    setAnalyzingImage(true);
    setImageMessage("이미지를 분석하는 중입니다.");

    try {
      const { response, data } = await analyzeImage(imageFile);

      if (response.status === 401) {
        onSessionExpired("세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.detail || "이미지 분석에 실패했습니다.");
      }

      const nextAnalysis: ImageAnalysis = {
        recommendedKeywords: data.recommendedKeywords ?? [],
        recommendedSummary: data.recommendedSummary ?? "",
        features: data.features ?? {},
      };

      setImageAnalysis(nextAnalysis);
      setForm((current) => ({
        ...current,
        keywords: nextAnalysis.recommendedKeywords.length
          ? nextAnalysis.recommendedKeywords.join(", ")
          : current.keywords,
        summary: nextAnalysis.recommendedSummary || current.summary,
      }));
      setImageMessage("이미지 분석 결과를 키워드와 제품 요약에 반영했습니다.");
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : "이미지 분석 중 예기치 않은 오류가 발생했습니다.");
    } finally {
      setAnalyzingImage(false);
    }
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
      tone: form.tone,
      ...(imageAnalysis ? { imageAnalysis } : {}),
    };

    if (!payload.name || !payload.keywords.length || !payload.summary) {
      setResult({
        status: "error",
        content: "마케팅 문구를 생성하려면 모든 항목을 입력해 주세요.",
      });
      return;
    }

    setResult({
      status: "loading",
      content: "마케팅 문구를 생성하는 중입니다.",
    });

    try {
      const { response, data } = await generateCopy(payload);

      if (response.status === 401) {
        onSessionExpired("세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }

      if (!response.ok) {
        throw new Error(data.detail || "마케팅 문구 생성에 실패했습니다.");
      }

      setResult({
        status: "success",
        content: data.generated_text || "",
      });
      if (data.id) {
        onGenerated(data.id);
        return;
      }
      throw new Error(data.detail || "저장된 생성 결과 ID를 받지 못했습니다.");
    } catch (error) {
      setResult({
        status: "error",
        content: error instanceof Error ? error.message : "문구 생성 중 예기치 않은 오류가 발생했습니다.",
      });
    }
  }

  return {
    form,
    result,
    imagePreviewUrl,
    imageFileName: imageFile?.name ?? "",
    imageMessage,
    analyzingImage,
    handleChange,
    handleToneChange,
    handleImageChange,
    handleAnalyzeImage,
    handleSubmit,
  };
}

