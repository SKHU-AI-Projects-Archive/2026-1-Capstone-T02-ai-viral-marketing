import express = require("express");
import { Collection } from "mongodb";

import type { UserRecord } from "../db";
import { findUserById } from "../db";
import { requireAuth, requireCsrfToken } from "../middleware/auth";
import { aiRateLimit } from "../middleware/rateLimit";
import { uploadProductImage } from "../middleware/upload";
import { decryptGeminiApiKeyForRequest } from "../services/apiKeyCrypto";
import { postFastApiForm, relayJsonResponse } from "../services/fastApiClient";

type Request = express.Request;
type Response = express.Response;

const missingUserGeminiApiKeyMessage =
  "Gemini API 키가 설정되어 있지 않습니다. 설정에서 개인 Gemini API 키를 등록한 뒤 다시 시도해 주세요.";
const missingApiKeyEncryptionSecretMessage =
  "사용자 Gemini API 키를 복호화할 수 없습니다. 서버의 USER_API_KEY_ENCRYPTION_SECRET 설정을 확인해 주세요.";

export function createImageRouter(
  usersCollection: Collection<UserRecord>,
  userApiKeyEncryptionSecret: string | null,
  requireUserGeminiApiKey: boolean
): express.Router {
  const router = express.Router();

  router.post(
    "/analyze-image",
    aiRateLimit,
    requireAuth,
    requireCsrfToken,
    uploadProductImage,
    async (req: Request, res: Response) => {
      if (!req.file) {
        res.status(400).json({ detail: "이미지 파일을 업로드해 주세요." });
        return;
      }

      try {
        const user = await findUserById(usersCollection, req.session.user!.id);
        const userGeminiApiKey = user?.geminiApiKey;
        if (!userGeminiApiKey && requireUserGeminiApiKey) {
          res.status(403).json({ detail: missingUserGeminiApiKeyMessage });
          return;
        }

        let geminiApiKeyOverride: string | undefined;
        if (userGeminiApiKey) {
          if (!userApiKeyEncryptionSecret) {
            res.status(503).json({ detail: missingApiKeyEncryptionSecretMessage });
            return;
          }
          geminiApiKeyOverride = decryptGeminiApiKeyForRequest(userGeminiApiKey, userApiKeyEncryptionSecret);
        }

        const formData = new FormData();
        const blob = new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype });
        formData.append("file", blob, req.file.originalname);
        if (geminiApiKeyOverride) {
          formData.append("geminiApiKeyOverride", geminiApiKeyOverride);
        }

        const upstreamResponse = await postFastApiForm("/internal/analyze-image", formData);

        await relayJsonResponse(upstreamResponse, res);
      } catch (_error) {
        res.status(502).json({ detail: "이미지 분석 서버에 연결하지 못했습니다." });
      }
    }
  );

  return router;
}
