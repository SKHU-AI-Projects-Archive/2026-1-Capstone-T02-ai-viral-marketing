import { describe, expect, it } from "vitest";

import {
  decodeApiKeyEncryptionSecret,
  decryptGeminiApiKey,
  encryptGeminiApiKey,
  toGeminiApiKeyPublicMetadata,
} from "./services/apiKeyCrypto";

const TEST_SECRET = Buffer.from("12345678901234567890123456789012", "utf8").toString("base64");
const USER_ID = "66507f3a9eac2a7f0d2f0001";
const OTHER_USER_ID = "66507f3a9eac2a7f0d2f0002";

describe("apiKeyCrypto", () => {
  it("encrypts and decrypts Gemini API keys without storing plaintext", () => {
    const apiKey = "AIza-test-user-secret-key";
    const now = new Date("2026-05-29T00:00:00.000Z");

    const encrypted = encryptGeminiApiKey(apiKey, TEST_SECRET, { now, userId: USER_ID });

    expect(encrypted.version).toBe(2);
    expect(encrypted.encryptedValue).not.toContain(apiKey);
    expect(encrypted.keyPreview).toBe("-key");
    expect(encrypted.createdAt).toBe(now);
    expect(encrypted.updatedAt).toBe(now);
    expect(decryptGeminiApiKey(encrypted, TEST_SECRET, USER_ID)).toBe(apiKey);
    expect(() => decryptGeminiApiKey(encrypted, TEST_SECRET, OTHER_USER_ID)).toThrow();
  });

  it("keeps read compatibility for legacy v1 records", () => {
    const apiKey = "AIza-legacy-user-secret-key";
    const encrypted = encryptGeminiApiKey(apiKey, TEST_SECRET);

    expect(encrypted.version).toBe(1);
    expect(decryptGeminiApiKey(encrypted, TEST_SECRET)).toBe(apiKey);
  });

  it("preserves original createdAt and stores verification metadata when replacing a key", () => {
    const createdAt = new Date("2026-05-28T00:00:00.000Z");
    const updatedAt = new Date("2026-05-29T00:00:00.000Z");
    const verifiedAt = new Date("2026-05-29T00:01:00.000Z");

    const encrypted = encryptGeminiApiKey("new-api-key-value", TEST_SECRET, {
      now: updatedAt,
      existingCreatedAt: createdAt,
      verifiedAt,
      userId: USER_ID,
    });

    expect(encrypted.createdAt).toBe(createdAt);
    expect(encrypted.updatedAt).toBe(updatedAt);
    expect(encrypted.verifiedAt).toBe(verifiedAt);
  });

  it("returns public metadata without exposing encrypted values", () => {
    const encrypted = encryptGeminiApiKey("AIza-test-user-secret-key", TEST_SECRET, { userId: USER_ID });

    const metadata = toGeminiApiKeyPublicMetadata(encrypted);

    expect(metadata).toMatchObject({
      configured: true,
      keyPreview: "-key",
    });
    expect(metadata).not.toHaveProperty("encryptedValue");
    expect(metadata).not.toHaveProperty("authTag");
    expect(toGeminiApiKeyPublicMetadata()).toEqual({ configured: false });
  });

  it("rejects secrets that do not decode to 32 bytes", () => {
    expect(() => decodeApiKeyEncryptionSecret(Buffer.from("too-short").toString("base64"))).toThrow(
      "32 bytes"
    );
  });
});
