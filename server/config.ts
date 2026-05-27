import * as path from "path";

import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env") });

const DEFAULT_PORT = 3000;
const DEFAULT_SESSION_SECRET = "replace-this-session-secret";
const DEFAULT_FASTAPI_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_FRONTEND_DEV_URL = "http://127.0.0.1:5173";
const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";

export type ServerConfig = {
  nodeEnv: string;
  port: number;
  mongoUrl: string;
  sessionSecret: string;
  fastApiBaseUrl: string;
  frontendDevUrl: string;
  redisUrl: string;
};

function readTrimmedEnv(name: string): string {
  return String(process.env[name] || "").trim();
}

function requireEnv(name: string): string {
  const value = readTrimmedEnv(name);
  if (!value) {
    throw new Error(`${name} 환경 변수가 설정되어 있지 않습니다.`);
  }
  return value;
}

function parsePort(rawValue: string): number {
  if (!rawValue) {
    return DEFAULT_PORT;
  }

  const port = Number(rawValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT 환경 변수는 1~65535 사이의 정수여야 합니다.");
  }
  return port;
}

function parseHttpUrl(name: string, rawValue: string, defaultValue: string): string {
  const value = rawValue || defaultValue;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (_error) {
    throw new Error(`${name} 환경 변수는 올바른 URL 형식이어야 합니다.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${name} 환경 변수는 http 또는 https URL이어야 합니다.`);
  }

  return value.replace(/\/+$/, "");
}

function parseRedisUrl(name: string, rawValue: string, defaultValue: string): string {
  const value = rawValue || defaultValue;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (_error) {
    throw new Error(`${name} 환경 변수는 올바른 Redis URL 형식이어야 합니다.`);
  }

  if (parsed.protocol !== "redis:" && parsed.protocol !== "rediss:") {
    throw new Error(`${name} 환경 변수는 redis 또는 rediss URL이어야 합니다.`);
  }

  return value;
}

function parseSessionSecret(nodeEnv: string): string {
  const rawSecret = readTrimmedEnv("SESSION_SECRET");
  if (nodeEnv === "production" && (!rawSecret || rawSecret === DEFAULT_SESSION_SECRET)) {
    throw new Error("production 환경에서는 SESSION_SECRET을 안전한 고유 값으로 설정해야 합니다.");
  }
  return rawSecret || DEFAULT_SESSION_SECRET;
}

export function loadServerConfig(): ServerConfig {
  const nodeEnv = readTrimmedEnv("NODE_ENV") || "development";

  return {
    nodeEnv,
    port: parsePort(readTrimmedEnv("PORT")),
    mongoUrl: requireEnv("MONGO_DB"),
    sessionSecret: parseSessionSecret(nodeEnv),
    fastApiBaseUrl: parseHttpUrl("FASTAPI_BASE_URL", readTrimmedEnv("FASTAPI_BASE_URL"), DEFAULT_FASTAPI_BASE_URL),
    frontendDevUrl: parseHttpUrl("FRONTEND_DEV_URL", readTrimmedEnv("FRONTEND_DEV_URL"), DEFAULT_FRONTEND_DEV_URL),
    redisUrl: parseRedisUrl("REDIS_URL", readTrimmedEnv("REDIS_URL"), DEFAULT_REDIS_URL),
  };
}

export const serverConfig = loadServerConfig();
