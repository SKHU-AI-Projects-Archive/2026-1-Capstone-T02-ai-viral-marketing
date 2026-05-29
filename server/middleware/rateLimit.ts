const { rateLimit } = require("express-rate-limit") as typeof import("express-rate-limit");

import { serverConfig } from "../config";

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: serverConfig.nodeEnv === "production" ? 10 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "인증 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
});

export const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: serverConfig.nodeEnv === "production" ? 30 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "AI 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
});

export const settingsRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: serverConfig.nodeEnv === "production" ? 10 : 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "설정 변경 요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." },
});
