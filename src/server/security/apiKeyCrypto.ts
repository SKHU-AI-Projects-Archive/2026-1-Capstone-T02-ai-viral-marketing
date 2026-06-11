import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import type { UserGeminiApiKey } from "../db";

const ALGORITHM = "aes-256-gcm";
const ENCRYPTION_KEY_BYTES = 32;
const IV_BYTES = 12;
const KEY_PREVIEW_LENGTH = 4;

type EncryptGeminiApiKeyOptions = {
  now?: Date;
  verifiedAt?: Date;
  existingCreatedAt?: Date;
  userId?: string;
};

export type GeminiApiKeySettingsMetadata = {
  configured: boolean;
  keyPreview?: string;
  updatedAt?: Date;
  verifiedAt?: Date;
};

export function decodeApiKeyEncryptionSecret(rawSecret: string): Buffer {
  const secret = rawSecret.trim();
  if (!secret) {
    throw new Error("USER_API_KEY_ENCRYPTION_SECRET is required to encrypt user API keys.");
  }

  const decoded = /^[0-9a-fA-F]{64}$/.test(secret)
    ? Buffer.from(secret, "hex")
    : Buffer.from(secret, "base64");

  if (decoded.length !== ENCRYPTION_KEY_BYTES) {
    throw new Error("USER_API_KEY_ENCRYPTION_SECRET must decode to exactly 32 bytes.");
  }

  return decoded;
}

export function createGeminiApiKeyPreview(apiKey: string): string {
  const normalizedApiKey = apiKey.trim();
  if (normalizedApiKey.length <= KEY_PREVIEW_LENGTH) {
    return normalizedApiKey;
  }
  return normalizedApiKey.slice(-KEY_PREVIEW_LENGTH);
}

function normalizeUserIdForAad(userId: string): string {
  const normalizedUserId = userId.trim();
  if (!normalizedUserId) {
    throw new Error("userId is required to bind an encrypted Gemini API key.");
  }
  return normalizedUserId;
}

export function encryptGeminiApiKey(
  apiKey: string,
  rawSecret: string,
  options: EncryptGeminiApiKeyOptions = {}
): UserGeminiApiKey {
  const normalizedApiKey = apiKey.trim();
  if (!normalizedApiKey) {
    throw new Error("Gemini API key is required.");
  }

  const now = options.now ?? new Date();
  const encryptionKey = decodeApiKeyEncryptionSecret(rawSecret);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
  const userId = options.userId ? normalizeUserIdForAad(options.userId) : null;
  if (userId) {
    cipher.setAAD(Buffer.from(userId, "utf8"));
  }
  const encryptedValue = Buffer.concat([cipher.update(normalizedApiKey, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ...(userId ? { version: 2 as const } : { version: 1 as const }),
    encryptedValue: encryptedValue.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    keyPreview: createGeminiApiKeyPreview(normalizedApiKey),
    createdAt: options.existingCreatedAt ?? now,
    updatedAt: now,
    ...(options.verifiedAt ? { verifiedAt: options.verifiedAt } : {}),
  };
}

export function decryptGeminiApiKey(record: UserGeminiApiKey, rawSecret: string, userId?: string): string {
  const encryptionKey = decodeApiKeyEncryptionSecret(rawSecret);
  const decipher = createDecipheriv(ALGORITHM, encryptionKey, Buffer.from(record.iv, "base64"));
  if (record.version === 2) {
    decipher.setAAD(Buffer.from(normalizeUserIdForAad(userId || ""), "utf8"));
  }
  decipher.setAuthTag(Buffer.from(record.authTag, "base64"));

  return Buffer.concat([decipher.update(Buffer.from(record.encryptedValue, "base64")), decipher.final()]).toString("utf8");
}

export function decryptGeminiApiKeyForRequest(record: UserGeminiApiKey, rawSecret: string, userId: string): string {
  return decryptGeminiApiKey(record, rawSecret, userId);
}

export function toGeminiApiKeySettingsMetadata(record?: UserGeminiApiKey): GeminiApiKeySettingsMetadata {
  if (!record) {
    return { configured: false };
  }

  return {
    configured: true,
    keyPreview: record.keyPreview,
    updatedAt: record.updatedAt,
    verifiedAt: record.verifiedAt,
  };
}
