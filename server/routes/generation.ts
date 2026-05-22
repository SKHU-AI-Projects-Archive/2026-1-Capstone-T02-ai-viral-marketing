import express = require("express");
import { Collection, ObjectId } from "mongodb";

import { GenerationRecord } from "../generationStore";
import {
  findGenerationForUser,
  listGenerationsForUser,
  normalizeGenerationInput,
  saveGeneratedArticle,
  toGenerationListItem,
  toGenerationResponse,
  validateGenerationInput,
} from "../generationStore";
import { requireAuth, requireCsrfToken } from "../middleware/auth";
import { aiRateLimit } from "../middleware/rateLimit";
import { postFastApiJson, relayJsonResponse } from "../services/fastApiClient";

type Request = express.Request;
type Response = express.Response;

export function createGenerationRouter(generationsCollection: Collection<GenerationRecord>): express.Router {
  const router = express.Router();

  router.post("/generate", aiRateLimit, requireAuth, requireCsrfToken, async (req: Request, res: Response) => {
    const input = normalizeGenerationInput(req.body);
    const validationError = validateGenerationInput(input);
    if (validationError) {
      res.status(400).json({ detail: validationError });
      return;
    }

    let upstreamResponse: globalThis.Response;
    try {
      upstreamResponse = await postFastApiJson("/internal/generate", input);
    } catch (error) {
      console.error("[generate] FastAPI fetch failed:", error);
      res.status(502).json({ detail: "AI 생성 서버에 연결하지 못했습니다." });
      return;
    }

    const contentType = upstreamResponse.headers.get("content-type") || "";
    if (!upstreamResponse.ok || !contentType.includes("application/json")) {
      await relayJsonResponse(upstreamResponse, res);
      return;
    }

    const data = (await upstreamResponse.json()) as { generated_text?: string };
    const generatedText = data.generated_text || "";
    const sessionUser = req.session.user!;

    try {
      const savedGeneration = await saveGeneratedArticle(
        generationsCollection,
        sessionUser.id,
        input,
        generatedText
      );

      console.log(
        `[generate] auto-saved generation ${savedGeneration._id.toString()} for user ${sessionUser.id}`
      );

      res.status(upstreamResponse.status).json(toGenerationResponse(savedGeneration));
    } catch (error) {
      console.error("[generate] Mongo insert failed:", error);
      res.status(500).json({
        generated_text: generatedText,
        detail: "결과 저장에 실패했습니다. 생성된 텍스트는 표시됩니다.",
      });
    }
  });

  router.get("/generations", requireAuth, async (req: Request, res: Response) => {
    const rawLimit = Number(req.query.limit || 20);
    const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50) : 20;
    const sessionUser = req.session.user!;

    try {
      const records = await listGenerationsForUser(generationsCollection, sessionUser.id, limit);
      res.json({
        items: records.map(toGenerationListItem),
      });
    } catch (_error) {
      res.status(500).json({ detail: "생성 결과 목록 조회 중 오류가 발생했습니다." });
    }
  });

  router.get("/generations/:id", requireAuth, async (req: Request, res: Response) => {
    const rawId = String(req.params.id || "");
    if (!ObjectId.isValid(rawId)) {
      res.status(400).json({ detail: "잘못된 생성 결과 ID 입니다." });
      return;
    }

    try {
      const sessionUser = req.session.user!;
      const record = await findGenerationForUser(generationsCollection, sessionUser.id, rawId);
      if (!record) {
        res.status(404).json({ detail: "생성 결과를 찾을 수 없습니다." });
        return;
      }

      res.json(toGenerationResponse(record));
    } catch (_error) {
      res.status(500).json({ detail: "생성 결과 조회 중 오류가 발생했습니다." });
    }
  });

  return router;
}

