import { NextRequest } from "next/server";

import { serverConfig } from "../config";

type Bucket = {
  count: number;
  resetAt: number;
};

type RateLimitOptions = {
  name: string;
  windowMs: number;
  developmentLimit: number;
  productionLimit: number;
};

const buckets = new Map<string, Bucket>();

function clientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip") || "unknown";
}

export function checkRateLimit(request: NextRequest, options: RateLimitOptions): { ok: true } | { ok: false; status: 429; detail: string } {
  const limit = serverConfig.nodeEnv === "production" ? options.productionLimit : options.developmentLimit;
  const now = Date.now();
  const key = `${options.name}:${clientIp(request)}`;
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs });
    return { ok: true };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, status: 429, detail: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." };
  }

  return { ok: true };
}

export const authRateLimit = {
  name: "auth",
  windowMs: 15 * 60 * 1000,
  developmentLimit: 30,
  productionLimit: 10,
};

export const aiRateLimit = {
  name: "ai",
  windowMs: 15 * 60 * 1000,
  developmentLimit: 100,
  productionLimit: 30,
};

export const settingsRateLimit = {
  name: "settings",
  windowMs: 15 * 60 * 1000,
  developmentLimit: 30,
  productionLimit: 10,
};
