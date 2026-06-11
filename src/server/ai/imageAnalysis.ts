import { extractGeneratedText, postGemini } from "./geminiClient";
import { IMAGE_ANALYSIS_PROMPT } from "./prompts/imageAnalysis";

export type ImageAnalysisResult = {
  recommendedKeywords: string[];
  recommendedSummary: string;
  features: {
    category: string;
    colors: string[];
    materials: string[];
    style_keywords: string[];
    use_cases: string[];
    target_audience: string[];
    selling_points: string[];
    detected_text: string[];
    uncertainties: string[];
  };
};

function parseJsonObject(text: string): Record<string, unknown> {
  let cleaned = text.trim();
  if (cleaned.startsWith("```")) {
    const lines = cleaned.split(/\r?\n/u);
    if (lines[0]?.startsWith("```")) {
      lines.shift();
    }
    if (lines[lines.length - 1]?.trim() === "```") {
      lines.pop();
    }
    cleaned = lines.join("\n").trim();
  }

  const parsed = JSON.parse(cleaned) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Gemini image analysis response must be a JSON object.");
  }
  return parsed as Record<string, unknown>;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean);
}

function normalizeImageAnalysis(data: Record<string, unknown>): ImageAnalysisResult {
  const rawFeatures = data.features && typeof data.features === "object" ? (data.features as Record<string, unknown>) : data;
  const features = {
    category: rawFeatures.category ? String(rawFeatures.category).trim() : "",
    colors: asStringList(rawFeatures.colors),
    materials: asStringList(rawFeatures.materials),
    style_keywords: asStringList(rawFeatures.style_keywords),
    use_cases: asStringList(rawFeatures.use_cases),
    target_audience: asStringList(rawFeatures.target_audience),
    selling_points: asStringList(rawFeatures.selling_points),
    detected_text: asStringList(rawFeatures.detected_text),
    uncertainties: asStringList(rawFeatures.uncertainties),
  };

  let recommendedKeywords = asStringList(data.recommendedKeywords);
  if (!recommendedKeywords.length) {
    recommendedKeywords = [
      features.category,
      ...features.colors,
      ...features.materials,
      ...features.style_keywords,
      ...features.use_cases,
      ...features.selling_points,
    ].filter(Boolean);
  }

  let recommendedSummary = data.recommendedSummary ? String(data.recommendedSummary).trim() : "";
  if (!recommendedSummary) {
    recommendedSummary = [features.category, features.colors.join(", "), (features.style_keywords.length ? features.style_keywords : features.selling_points).join(", ")]
      .filter(Boolean)
      .join(" / ");
  }

  return {
    recommendedKeywords: Array.from(new Set(recommendedKeywords)).slice(0, 12),
    recommendedSummary,
    features,
  };
}

export async function analyzeProductImage(params: {
  imageBytes: Buffer;
  mediaType: string;
  apiKeyOverride: string;
}): Promise<ImageAnalysisResult> {
  if (!params.imageBytes.length) {
    throw new Error("Uploaded image is empty.");
  }

  const payload = {
    contents: [
      {
        parts: [
          { text: IMAGE_ANALYSIS_PROMPT },
          {
            inline_data: {
              mime_type: params.mediaType,
              data: params.imageBytes.toString("base64"),
            },
          },
        ],
      },
    ],
    generationConfig: {
      response_mime_type: "application/json",
    },
  };

  const response = await postGemini(payload, {
    imageAnalysis: true,
    apiKeyOverride: params.apiKeyOverride,
  });
  return normalizeImageAnalysis(parseJsonObject(extractGeneratedText(response)));
}
