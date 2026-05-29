import express = require("express");
import { Collection, ObjectId } from "mongodb";

import type {} from "../express-session";
import type { UserRecord } from "../db";
import { requireAuth, requireCsrfToken } from "../middleware/auth";
import { settingsRateLimit } from "../middleware/rateLimit";
import {
  encryptGeminiApiKey,
  toGeminiApiKeySettingsMetadata,
} from "../services/apiKeyCrypto";

type Request = express.Request;
type Response = express.Response;

const MIN_GEMINI_API_KEY_LENGTH = 20;
const MAX_GEMINI_API_KEY_LENGTH = 256;
const invalidGeminiApiKeyMessage = "Gemini API 키를 올바르게 입력해 주세요.";

function getSessionUserId(req: Request): ObjectId | null {
  const userId = String(req.session.user?.id || "");
  if (!ObjectId.isValid(userId)) {
    return null;
  }

  return new ObjectId(userId);
}

function readApiKey(body: unknown): string {
  const payload = body as { apiKey?: unknown; geminiApiKey?: unknown } | null;
  const value = payload?.apiKey ?? payload?.geminiApiKey;
  if (typeof value !== "string") {
    return "";
  }
  return value.trim();
}

function isValidGeminiApiKeyInput(apiKey: string): boolean {
  if (apiKey.length < MIN_GEMINI_API_KEY_LENGTH || apiKey.length > MAX_GEMINI_API_KEY_LENGTH) {
    return false;
  }
  if (/[\s\u0000-\u001f\u007f]/u.test(apiKey)) {
    return false;
  }
  return /^[A-Za-z0-9_-]+$/.test(apiKey);
}

export function createSettingsRouter(
  usersCollection: Collection<UserRecord>,
  userApiKeyEncryptionSecret: string | null
): express.Router {
  const router = express.Router();

  router.get("/settings/gemini-key", requireAuth, async (req: Request, res: Response) => {
    const userId = getSessionUserId(req);
    if (!userId) {
      res.status(401).json({ detail: "로그인이 필요합니다." });
      return;
    }

    const user = await usersCollection.findOne({ _id: userId } as never);
    res.json(toGeminiApiKeySettingsMetadata(user?.geminiApiKey));
  });

  router.put(
    "/settings/gemini-key",
    settingsRateLimit,
    requireAuth,
    requireCsrfToken,
    async (req: Request, res: Response) => {
      const userId = getSessionUserId(req);
      if (!userId) {
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
      if (!isValidGeminiApiKeyInput(apiKey)) {
        res.status(400).json({ detail: invalidGeminiApiKeyMessage });
        return;
      }

      const existingUser = await usersCollection.findOne({ _id: userId } as never);
      if (!existingUser) {
        res.status(404).json({ detail: "사용자를 찾을 수 없습니다." });
        return;
      }

      const encryptedApiKey = encryptGeminiApiKey(apiKey, userApiKeyEncryptionSecret, {
        existingCreatedAt: existingUser.geminiApiKey?.createdAt,
        userId: userId.toString(),
      });
      await usersCollection.updateOne({ _id: userId } as never, { $set: { geminiApiKey: encryptedApiKey } });

      res.json(toGeminiApiKeySettingsMetadata(encryptedApiKey));
    }
  );

  router.delete(
    "/settings/gemini-key",
    settingsRateLimit,
    requireAuth,
    requireCsrfToken,
    async (req: Request, res: Response) => {
      const userId = getSessionUserId(req);
      if (!userId) {
        res.status(401).json({ detail: "로그인이 필요합니다." });
        return;
      }

      await usersCollection.updateOne({ _id: userId } as never, { $unset: { geminiApiKey: "" } });
      res.json(toGeminiApiKeySettingsMetadata());
    }
  );

  return router;
}
