import express = require("express");
import { Collection, ObjectId } from "mongodb";

import type {} from "../express-session";
import { GenerationRecord } from "../generationStore";
import {
  findGenerationForUser,
  listGenerationsForUser,
  toGenerationListItem,
  toGenerationResponse,
} from "../generationStore";
import { requireAuth, requireCsrfToken } from "../middleware/auth";
import { aiRateLimit } from "../middleware/rateLimit";

type Request = express.Request;
type Response = express.Response;

export function createGenerationRouter(generationsCollection: Collection<GenerationRecord>): express.Router {
  const router = express.Router();

  router.post("/generate", aiRateLimit, requireAuth, requireCsrfToken, async (_req: Request, res: Response) => {
    res.status(410).json({
      detail: "동기 생성 API는 더 이상 지원하지 않습니다. POST /api/generation-jobs를 사용해 주세요.",
    });
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
      res.status(400).json({ detail: "잘못된 생성 결과 ID입니다." });
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
