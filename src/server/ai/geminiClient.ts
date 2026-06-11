import { serverConfig } from "../config";

export class GeminiOutputTruncatedError extends Error {}

function extractErrorMessage(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") {
    return fallback;
  }
  const error = (data as { error?: unknown }).error;
  if (!error || typeof error !== "object") {
    return fallback;
  }
  const message = (error as { message?: unknown }).message;
  const status = (error as { status?: unknown }).status;
  if (message && status) {
    return `${String(status)}: ${String(message)}`;
  }
  return message ? String(message) : fallback;
}

export async function postGemini(
  payload: unknown,
  options: {
    imageAnalysis?: boolean;
    apiKeyOverride: string;
  }
): Promise<Record<string, unknown>> {
  const apiKey = options.apiKeyOverride.trim();
  if (!apiKey) {
    throw new Error("Gemini API key override is required.");
  }

  const timeoutSeconds = options.imageAnalysis
    ? serverConfig.geminiImageTimeoutSeconds
    : serverConfig.geminiGenerateTimeoutSeconds;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${serverConfig.geminiModel}:generateContent`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const responseText = await response.text();
    let data: unknown = null;
    if (responseText.trim()) {
      try {
        data = JSON.parse(responseText);
      } catch {
        data = null;
      }
    }

    if (!response.ok) {
      const providerMessage = extractErrorMessage(data, response.statusText || "Unknown Gemini API error.");
      if (response.status === 401 || response.status === 403) {
        throw new Error(`Gemini authentication failed. Verify the user's Gemini API key. Provider said: ${providerMessage}`);
      }
      if (response.status === 429) {
        throw new Error(`Gemini quota exceeded or rate-limited. Provider said: ${providerMessage}`);
      }
      throw new Error(`Gemini API error: status=${response.status}. Provider said: ${providerMessage}`);
    }

    if (!data || typeof data !== "object") {
      throw new Error("Gemini response was not valid JSON.");
    }
    return data as Record<string, unknown>;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      const timeoutEnvHint = options.imageAnalysis ? "GEMINI_IMAGE_TIMEOUT_SECONDS" : "GEMINI_GENERATE_TIMEOUT_SECONDS";
      throw new Error(`Gemini request timed out. Check network access or increase ${timeoutEnvHint}.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function extractGeneratedText(data: Record<string, unknown>): string {
  const candidates = data.candidates;
  if (!Array.isArray(candidates) || !candidates[0] || typeof candidates[0] !== "object") {
    throw new Error("Gemini response format was unexpected.");
  }

  const candidate = candidates[0] as Record<string, unknown>;
  const content = candidate.content;
  const parts = content && typeof content === "object" ? (content as Record<string, unknown>).parts : null;
  if (!Array.isArray(parts)) {
    throw new Error("Gemini response format was unexpected.");
  }

  const generatedText = parts.map((part) => (part && typeof part === "object" ? String((part as { text?: unknown }).text || "") : "")).join("").trim();
  const finishReason = String(candidate.finishReason || "").toUpperCase();
  if (finishReason === "MAX_TOKENS") {
    throw new GeminiOutputTruncatedError("Gemini stopped before finishing the response.");
  }
  if (!generatedText) {
    throw new Error("Gemini returned an empty response.");
  }
  return generatedText;
}
