import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import { uploadBlogImage } from "../api/blogImages";
import { analyzeImage } from "../api/image";
import { createGenerationJob, fetchGenerationJob } from "../api/jobs";
import type { BlogImage, GenerateRequest, GenerationJobResponse, ImageAnalysis, Tone } from "../api/types";

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
const MAX_BLOG_IMAGES = 5;

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

const GEMINI_KEY_SETUP_MESSAGE = "설정에서 Gemini API 키를 등록해 주세요.";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function describeJobStatus(job: GenerationJobResponse): string {
  if (job.status === "queued") {
    return "생성 작업이 대기열에 등록되었습니다.";
  }
  if (job.status === "running") {
    return `AI가 마케팅 문구를 생성하는 중입니다. (${job.attempts}/${job.maxAttempts})`;
  }
  return "마케팅 문구를 생성하는 중입니다.";
}

function needsGeminiKeySetup(message?: string, code?: string): boolean {
  return code === "USER_GEMINI_API_KEY_REQUIRED" || String(message || "").includes("Gemini API 키");
}

function labelFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").trim().slice(0, 30) || "블로그 이미지";
}

export function useGenerationForm({ onGenerated, onSessionExpired }: UseGenerationFormOptions) {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [result, setResult] = useState(INITIAL_RESULT);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState("");
  const [imageMessage, setImageMessage] = useState("");
  const [imageAnalysis, setImageAnalysis] = useState<ImageAnalysis | null>(null);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [needsGeminiKeySetupAction, setNeedsGeminiKeySetupAction] = useState(false);
  const [blogImages, setBlogImages] = useState<BlogImage[]>([]);
  const [blogImageMessage, setBlogImageMessage] = useState("");
  const [uploadingBlogImages, setUploadingBlogImages] = useState(false);

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
    if (tone !== "blog") {
      setBlogImageMessage("블로그 이미지는 블로그 톤에서만 사용됩니다.");
    } else {
      setBlogImageMessage("");
    }
  }

  function handleRemoveBlogImage(id: string) {
    setBlogImages((current) => current.filter((image) => image.id !== id));
    setBlogImageMessage("");
  }

  function handleBlogImageChange(id: string, field: keyof BlogImage, value: string) {
    setBlogImages((current) =>
      current.map((image) => {
        if (image.id !== id) {
          return image;
        }

        return {
          ...image,
          [field]: value,
        };
      })
    );
    setBlogImageMessage("");
  }

  async function handleBlogImageFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";

    if (form.tone !== "blog") {
      setBlogImageMessage("블로그 이미지는 블로그 톤에서만 업로드할 수 있습니다.");
      return;
    }

    if (!files.length) {
      return;
    }

    const remainingSlots = MAX_BLOG_IMAGES - blogImages.length;
    if (remainingSlots <= 0) {
      setBlogImageMessage(`블로그 이미지는 최대 ${MAX_BLOG_IMAGES}개까지 등록할 수 있습니다.`);
      return;
    }

    const selectedFiles = files.slice(0, remainingSlots);
    if (files.length > remainingSlots) {
      setBlogImageMessage(`남은 ${remainingSlots}개만 업로드합니다. 블로그 이미지는 최대 ${MAX_BLOG_IMAGES}개까지 등록할 수 있습니다.`);
    }

    for (const file of selectedFiles) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        setBlogImageMessage(`${ALLOWED_IMAGE_TYPE_LABEL} 형식의 이미지만 업로드할 수 있습니다.`);
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setBlogImageMessage("블로그 이미지 파일은 4MB 이하만 업로드할 수 있습니다.");
        return;
      }
    }

    setUploadingBlogImages(true);
    setBlogImageMessage("Cloudinary에 블로그 이미지를 업로드하는 중입니다.");

    try {
      const uploadedImages: BlogImage[] = [];
      for (const file of selectedFiles) {
        const { response, data } = await uploadBlogImage(file, {
          label: labelFromFilename(file.name),
        });

        if (response.status === 401) {
          onSessionExpired("세션이 만료되었습니다. 다시 로그인해 주세요.");
          return;
        }

        if (!response.ok || !data.cloudinaryPublicId) {
          throw new Error(data.detail || "Cloudinary 이미지 업로드에 실패했습니다.");
        }

        uploadedImages.push(data);
      }

      setBlogImages((current) => [...current, ...uploadedImages].slice(0, MAX_BLOG_IMAGES));
      setBlogImageMessage("Cloudinary 업로드가 완료되었습니다. 라벨과 배치 힌트를 확인해 주세요.");
    } catch (error) {
      setBlogImageMessage(error instanceof Error ? error.message : "Cloudinary 이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadingBlogImages(false);
    }
  }

  function prepareBlogImages(): BlogImage[] {
    if (form.tone !== "blog") {
      return [];
    }

    return blogImages
      .map((image) => ({
        ...image,
        label: image.label.trim(),
        description: image.description?.trim() || undefined,
        placementHint: image.placementHint?.trim() || undefined,
        sourceUrl: image.sourceUrl.trim(),
      }))
      .filter((image) => image.label || image.sourceUrl);
  }

  function validateBlogImagesForSubmit(images: BlogImage[]): string | null {
    if (images.length > MAX_BLOG_IMAGES) {
      return `블로그 이미지는 최대 ${MAX_BLOG_IMAGES}개까지 등록할 수 있습니다.`;
    }

    const labels = new Set<string>();
    const cloudinaryPublicIds = new Set<string>();
    for (const image of images) {
      if (!image.label) {
        return "블로그 이미지 라벨을 입력해 주세요.";
      }
      if (!image.cloudinaryPublicId || !image.displayUrl) {
        return "Cloudinary 업로드가 완료된 이미지만 사용할 수 있습니다.";
      }

      const normalizedLabel = image.label.toLowerCase();
      if (labels.has(normalizedLabel)) {
        return "블로그 이미지 라벨은 중복될 수 없습니다.";
      }
      labels.add(normalizedLabel);

      if (cloudinaryPublicIds.has(image.cloudinaryPublicId)) {
        return "동일한 블로그 이미지는 한 번만 등록할 수 있습니다.";
      }
      cloudinaryPublicIds.add(image.cloudinaryPublicId);
    }

    return null;
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setImageMessage("");
    setImageAnalysis(null);
    setNeedsGeminiKeySetupAction(false);

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
    setNeedsGeminiKeySetupAction(false);
    setImageMessage("이미지를 분석하는 중입니다.");

    try {
      const { response, data } = await analyzeImage(imageFile);

      if (response.status === 401) {
        onSessionExpired("세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }

      if (!response.ok) {
        if (response.status === 403 && needsGeminiKeySetup(data.detail)) {
          setNeedsGeminiKeySetupAction(true);
          throw new Error(GEMINI_KEY_SETUP_MESSAGE);
        }
        throw new Error(data.detail || "이미지 분석에 실패했습니다.");
      }

      const nextAnalysis: ImageAnalysis = {
        recommendedKeywords: data.recommendedKeywords ?? [],
        recommendedSummary: data.recommendedSummary ?? "",
        features: data.features ?? {},
      };

      setImageAnalysis(nextAnalysis);
      setNeedsGeminiKeySetupAction(false);
      setForm((current) => ({
        ...current,
        keywords: nextAnalysis.recommendedKeywords.length
          ? nextAnalysis.recommendedKeywords.join(", ")
          : current.keywords,
        summary: nextAnalysis.recommendedSummary || current.summary,
      }));
      setImageMessage("이미지 분석 결과를 키워드와 제품 요약에 반영했습니다.");
    } catch (error) {
      setImageMessage(error instanceof Error ? error.message : "이미지 분석 중 알 수 없는 오류가 발생했습니다.");
    } finally {
      setAnalyzingImage(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: GenerateRequest = {
      name: form.name.trim(),
      keywords: form.keywords
        .split(",")
        .map((keyword) => keyword.trim())
        .filter(Boolean),
      summary: form.summary.trim(),
      tone: form.tone,
      ...(imageAnalysis ? { imageAnalysis } : {}),
    };
    const nextBlogImages = prepareBlogImages();

    if (!payload.name || !payload.keywords.length || !payload.summary) {
      setResult({
        status: "error",
        content: "마케팅 문구를 생성하려면 모든 항목을 입력해 주세요.",
      });
      return;
    }

    const blogImageError = validateBlogImagesForSubmit(nextBlogImages);
    if (blogImageError) {
      setBlogImageMessage(blogImageError);
      setResult({
        status: "error",
        content: blogImageError,
      });
      return;
    }
    if (nextBlogImages.length) {
      payload.blogImages = nextBlogImages;
    }

    setResult({
      status: "loading",
      content: "마케팅 문구를 생성하는 중입니다.",
    });
    setNeedsGeminiKeySetupAction(false);

    try {
      const { response, data } = await createGenerationJob(payload);

      if (response.status === 401) {
        onSessionExpired("세션이 만료되었습니다. 다시 로그인해 주세요.");
        return;
      }

      if (!response.ok || !data.id) {
        if (response.status === 403 && needsGeminiKeySetup(data.detail)) {
          setNeedsGeminiKeySetupAction(true);
          throw new Error(GEMINI_KEY_SETUP_MESSAGE);
        }
        throw new Error(data.detail || "마케팅 문구 생성에 실패했습니다.");
      }

      for (let attempt = 0; attempt < 90; attempt += 1) {
        const { response: jobResponse, data: job } = await fetchGenerationJob(data.id);

        if (jobResponse.status === 401) {
          onSessionExpired("세션이 만료되었습니다. 다시 로그인해 주세요.");
          return;
        }

        if (!jobResponse.ok) {
          throw new Error(job.detail || "생성 작업 상태를 불러오지 못했습니다.");
        }

        if (job.status === "succeeded") {
          const generationId = job.result?.generationId || job.generationId;
          setResult({
            status: "success",
            content: job.result?.generated_text || "",
          });
          if (generationId) {
            onGenerated(generationId);
            return;
          }
          throw new Error("저장된 생성 결과 ID를 받지 못했습니다.");
        }

        if (job.status === "failed") {
          if (needsGeminiKeySetup(job.error?.message, job.error?.code)) {
            setNeedsGeminiKeySetupAction(true);
            throw new Error(GEMINI_KEY_SETUP_MESSAGE);
          }
          throw new Error(job.error?.message || "마케팅 문구 생성에 실패했습니다.");
        }

        setResult({
          status: "loading",
          content: describeJobStatus(job),
        });
        await delay(attempt < 10 ? 1_000 : 2_000);
      }

      throw new Error("생성 작업이 오래 걸리고 있습니다. 잠시 후 저장된 글 목록에서 다시 확인해 주세요.");
    } catch (error) {
      setResult({
        status: "error",
        content: error instanceof Error ? error.message : "문구 생성 중 알 수 없는 오류가 발생했습니다.",
      });
    }
  }

  return {
    form,
    result,
    imagePreviewUrl,
    imageFileName: imageFile?.name ?? "",
    imageMessage,
    blogImages,
    blogImageMessage,
    uploadingBlogImages,
    analyzingImage,
    needsGeminiKeySetupAction,
    handleChange,
    handleToneChange,
    handleImageChange,
    handleRemoveBlogImage,
    handleBlogImageChange,
    handleBlogImageFilesChange,
    handleAnalyzeImage,
    handleSubmit,
  };
}
