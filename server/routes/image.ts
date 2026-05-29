import express = require("express");

import { requireAuth, requireCsrfToken } from "../middleware/auth";
import { aiRateLimit } from "../middleware/rateLimit";
import { uploadProductImage } from "../middleware/upload";
import { postFastApiForm, relayJsonResponse } from "../services/fastApiClient";

type Request = express.Request;
type Response = express.Response;

export function createImageRouter(): express.Router {
  const router = express.Router();

  router.post("/analyze-image", aiRateLimit, requireAuth, requireCsrfToken, uploadProductImage, async (req: Request, res: Response) => {
    if (!req.file) {
      res.status(400).json({ detail: "이미지 파일을 업로드해 주세요." });
      return;
    }

    try {
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype });
      formData.append("file", blob, req.file.originalname);

      const upstreamResponse = await postFastApiForm("/internal/analyze-image", formData);

      await relayJsonResponse(upstreamResponse, res);
    } catch (_error) {
      res.status(502).json({ detail: "이미지 분석 서버에 연결하지 못했습니다." });
    }
  });

  return router;
}
