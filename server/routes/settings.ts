import express = require("express");
import { Collection, ObjectId, type Filter } from "mongodb";

import type {} from "../express-session";
import type { UserRecord } from "../db";
import { requireAuth, requireCsrfToken } from "../middleware/auth";
import {
  encryptGeminiApiKey,
  toGeminiApiKeySettingsMetadata,
} from "../services/apiKeyCrypto";

type Request = express.Request;
type Response = express.Response;

const MIN_GEMINI_API_KEY_LENGTH = 12;

function getSessionUserFilter(req: Request): Filter<UserRecord> | null {
  const userId = String(req.session.user?.id || "");
  if (!ObjectId.isValid(userId)) {
    return null;
  }

  return { _id: new ObjectId(userId) } as Filter<UserRecord>;
}

function readApiKey(body: unknown): string {
  const payload = body as { apiKey?: unknown; geminiApiKey?: unknown } | null;
  return String(payload?.apiKey ?? payload?.geminiApiKey ?? "").trim();
}

export function createSettingsRouter(
  usersCollection: Collection<UserRecord>,
  userApiKeyEncryptionSecret: string | null
): express.Router {
  const router = express.Router();

  router.get("/settings/gemini-key", requireAuth, async (req: Request, res: Response) => {
    const userFilter = getSessionUserFilter(req);
    if (!userFilter) {
      res.status(401).json({ detail: "로그인이 필요합니다." });
      return;
    }

    const user = await usersCollection.findOne(userFilter);
    res.json(toGeminiApiKeySettingsMetadata(user?.geminiApiKey));
  });

  router.put("/settings/gemini-key", requireAuth, requireCsrfToken, async (req: Request, res: Response) => {
    const userFilter = getSessionUserFilter(req);
    if (!userFilter) {
      res.status(401).json({ detail: "로그인이 필요합니다." });
      return;
    }

    if (!userApiKeyEncryptionSecret) {
      res.status(503).json({
        detail: "사용자 API 키 저장을 사용할 수 없습니다. USER_API_KEY_ENCRYPTION_SECRET을 설정해 주세요.",
      });
      return;
    }

    const apiKey = readApiKey(req.body);
    if (apiKey.length < MIN_GEMINI_API_KEY_LENGTH) {
      res.status(400).json({ detail: "Gemini API 키를 올바르게 입력해 주세요." });
      return;
    }

    const existingUser = await usersCollection.findOne(userFilter);
    if (!existingUser) {
      res.status(404).json({ detail: "사용자를 찾을 수 없습니다." });
      return;
    }

    const encryptedApiKey = encryptGeminiApiKey(apiKey, userApiKeyEncryptionSecret, {
      existingCreatedAt: existingUser.geminiApiKey?.createdAt,
    });
    await usersCollection.updateOne(userFilter, { $set: { geminiApiKey: encryptedApiKey } });

    res.json(toGeminiApiKeySettingsMetadata(encryptedApiKey));
  });

  router.delete("/settings/gemini-key", requireAuth, requireCsrfToken, async (req: Request, res: Response) => {
    const userFilter = getSessionUserFilter(req);
    if (!userFilter) {
      res.status(401).json({ detail: "로그인이 필요합니다." });
      return;
    }

    await usersCollection.updateOne(userFilter, { $unset: { geminiApiKey: "" } });
    res.json(toGeminiApiKeySettingsMetadata());
  });

  return router;
}
