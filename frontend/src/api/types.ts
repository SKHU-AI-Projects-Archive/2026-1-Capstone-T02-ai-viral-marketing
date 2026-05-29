export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type SessionResponse = {
  authenticated: boolean;
  user?: AuthUser;
};

export type Tone = "blog" | "coupang_review" | "community_comment";

export type GenerateRequest = {
  name: string;
  keywords: string[];
  summary: string;
  tone: Tone;
  imageAnalysis?: ImageAnalysis;
};

export type JobStatus = "queued" | "running" | "succeeded" | "failed";

export type GenerationJobResult = {
  generationId: string;
  generated_text: string;
};

export type GenerationJobResponse = {
  id: string;
  type: "generation";
  status: JobStatus;
  result: GenerationJobResult | null;
  error: {
    code?: string;
    message: string;
  } | null;
  attempts: number;
  maxAttempts: number;
  generationId?: string;
  queuedAt: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
  detail?: string;
};

export type GenerationFetchResponse = {
  id: string;
  name: string;
  keywords: string[];
  summary: string;
  tone: Tone;
  generated_text: string;
  imageAnalysisApplied?: boolean;
  saveSource?: "auto";
  createdAt: string;
  updatedAt?: string;
  detail?: string;
};

export type GenerationListItem = Omit<GenerationFetchResponse, "generated_text" | "detail"> & {
  preview: string;
};

export type GenerationListResponse = {
  items: GenerationListItem[];
  detail?: string;
};

export type ImageAnalysis = {
  recommendedKeywords: string[];
  recommendedSummary: string;
  features: Record<string, unknown>;
  detail?: string;
};

export type AuthSubmitRequest = {
  mode: "login" | "signup";
  name: string;
  email: string;
  password: string;
};

export type AuthSubmitResponse = {
  detail?: string;
  user?: AuthUser;
};

export type CsrfTokenResponse = {
  csrfToken: string;
  detail?: string;
};
