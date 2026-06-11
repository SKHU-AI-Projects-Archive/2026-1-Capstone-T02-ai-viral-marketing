import express = require("express");

import { requireAuth, requireCsrfToken } from "../middleware/auth";
import { aiRateLimit } from "../middleware/rateLimit";
import { uploadProductImage } from "../middleware/upload";
import type { CloudinaryRuntimeConfig } from "../services/cloudinaryService";
import {
  isCloudinaryConfigured,
  uploadImageToCloudinary,
} from "../services/cloudinaryService";

type Request = express.Request;
type Response = express.Response;

const missingConfigMessage =
  "Cloudinary 설정이 필요합니다. CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET을 확인해 주세요.";

function readTrimmedBodyField(req: Request, name: string): string {
  return String(req.body?.[name] || "").trim();
}

function labelFromFilename(filename: string): string {
  return filename.replace(/\.[^.]+$/, "").trim().slice(0, 30) || "블로그 이미지";
}

export function createBlogImagesRouter(cloudinaryConfig: CloudinaryRuntimeConfig): express.Router {
  const router = express.Router();

  router.post(
    "/blog-images",
    aiRateLimit,
    requireAuth,
    requireCsrfToken,
    uploadProductImage,
    async (req: Request, res: Response) => {
      if (!req.file) {
        res.status(400).json({ detail: "업로드할 이미지를 선택해 주세요." });
        return;
      }

      if (!isCloudinaryConfigured(cloudinaryConfig)) {
        res.status(503).json({ detail: missingConfigMessage });
        return;
      }

      try {
        const uploadedImage = await uploadImageToCloudinary(cloudinaryConfig, req.file);
        const label = readTrimmedBodyField(req, "label") || labelFromFilename(req.file.originalname);
        const description = readTrimmedBodyField(req, "description");
        const placementHint = readTrimmedBodyField(req, "placementHint");

        res.status(201).json({
          id: uploadedImage.cloudinaryPublicId,
          label,
          ...(description ? { description } : {}),
          ...(placementHint ? { placementHint } : {}),
          ...uploadedImage,
        });
      } catch (error) {
        console.error("[blog-images] Cloudinary upload failed:", error);
        res.status(502).json({ detail: "Cloudinary 이미지 업로드에 실패했습니다." });
      }
    }
  );

  return router;
}
