import express = require("express");
import multer = require("multer");

type NextFunction = express.NextFunction;
type Request = express.Request;
type Response = express.Response;

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
  },
  fileFilter: (_req, file, callback) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
      callback(new Error("UNSUPPORTED_IMAGE_TYPE"));
      return;
    }

    callback(null, true);
  },
});

export function uploadProductImage(req: Request, res: Response, next: NextFunction): void {
  upload.single("file")(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({ detail: "이미지 파일은 4MB 이하만 업로드할 수 있습니다." });
      return;
    }

    if (error instanceof Error && error.message === "UNSUPPORTED_IMAGE_TYPE") {
      res.status(400).json({ detail: "지원하지 않는 이미지 형식입니다. JPG, PNG, WEBP 파일만 업로드해 주세요." });
      return;
    }

    res.status(400).json({ detail: "이미지 파일 업로드 중 오류가 발생했습니다." });
  });
}
