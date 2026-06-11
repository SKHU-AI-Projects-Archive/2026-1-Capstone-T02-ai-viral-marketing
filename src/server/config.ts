import * as path from "path";

import * as dotenv from "dotenv";

dotenv.config({ path: path.join(process.cwd(), ".env"), override: true });

const DEFAULT_PORT = 3000;
const DEFAULT_SESSION_SECRET = "replace-this-session-secret";
const DEFAULT_REDIS_URL = "redis://127.0.0.1:6379";
const USER_API_KEY_ENCRYPTION_SECRET_BYTES = 32;

export type ServerConfig = {
  nodeEnv: string;
  port: number;
  mongoUrl: string;
  sessionSecret: string;
  redisUrl: string;
  userApiKeyEncryptionSecret: string | null;
  geminiModel: string;
  geminiGenerateTimeoutSeconds: number;
  geminiImageTimeoutSeconds: number;
  cloudinaryCloudName: string | null;
  cloudinaryApiKey: string | null;
  cloudinaryApiSecret: string | null;
  cloudinaryFolder: string;
};

function readTrimmedEnv(name: string): string {
  return String(process.env[name] || "").trim();
}

function parsePort(rawValue: string): number {
  if (!rawValue) {
    return DEFAULT_PORT;
  }

  const port = Number(rawValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }
  return port;
}

function parseRedisUrl(rawValue: string): string {
  return rawValue || DEFAULT_REDIS_URL;
}

function parsePositiveNumber(rawValue: string, fallback: number): number {
  const value = Number(rawValue);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function validateUserApiKeyEncryptionSecret(rawSecret: string): void {
  const secret = rawSecret.trim();
  const decoded = /^[0-9a-fA-F]{64}$/.test(secret)
    ? Buffer.from(secret, "hex")
    : Buffer.from(secret, "base64");

  if (decoded.length !== USER_API_KEY_ENCRYPTION_SECRET_BYTES) {
    throw new Error("USER_API_KEY_ENCRYPTION_SECRET must be a base64 or hex encoded 32-byte secret.");
  }
}

function parseUserApiKeyEncryptionSecret(nodeEnv: string): string | null {
  const rawSecret = readTrimmedEnv("USER_API_KEY_ENCRYPTION_SECRET");
  if (!rawSecret) {
    if (nodeEnv === "production") {
      throw new Error("production requires USER_API_KEY_ENCRYPTION_SECRET to store user API keys.");
    }
    return null;
  }

  validateUserApiKeyEncryptionSecret(rawSecret);
  return rawSecret;
}

function parseSessionSecret(nodeEnv: string): string {
  const rawSecret = readTrimmedEnv("SESSION_SECRET");
  if (nodeEnv === "production" && (!rawSecret || rawSecret === DEFAULT_SESSION_SECRET)) {
    throw new Error("production requires a strong SESSION_SECRET.");
  }
  return rawSecret || DEFAULT_SESSION_SECRET;
}

export function loadServerConfig(): ServerConfig {
  const nodeEnv = readTrimmedEnv("NODE_ENV") || "development";

  return {
    nodeEnv,
    port: parsePort(readTrimmedEnv("PORT")),
    mongoUrl: readTrimmedEnv("MONGO_DB"),
    sessionSecret: parseSessionSecret(nodeEnv),
    redisUrl: parseRedisUrl(readTrimmedEnv("REDIS_URL")),
    userApiKeyEncryptionSecret: parseUserApiKeyEncryptionSecret(nodeEnv),
    geminiModel: readTrimmedEnv("GEMINI_MODEL") || "gemini-1.5-flash",
    geminiGenerateTimeoutSeconds: parsePositiveNumber(readTrimmedEnv("GEMINI_GENERATE_TIMEOUT_SECONDS"), 60),
    geminiImageTimeoutSeconds: parsePositiveNumber(readTrimmedEnv("GEMINI_IMAGE_TIMEOUT_SECONDS"), 30),
    cloudinaryCloudName: readTrimmedEnv("CLOUDINARY_CLOUD_NAME") || null,
    cloudinaryApiKey: readTrimmedEnv("CLOUDINARY_API_KEY") || null,
    cloudinaryApiSecret: readTrimmedEnv("CLOUDINARY_API_SECRET") || null,
    cloudinaryFolder: readTrimmedEnv("CLOUDINARY_FOLDER") || "ovms/blog-images",
  };
}

export const serverConfig = loadServerConfig();
