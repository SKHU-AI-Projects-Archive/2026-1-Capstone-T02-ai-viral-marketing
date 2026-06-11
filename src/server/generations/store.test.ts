import { describe, expect, it } from "vitest";

import { normalizeGenerationInput, sanitizeGeneratedTextImages, validateGenerationInput } from "./store";

describe("generation store validation", () => {
  it("normalizes basic generation input", () => {
    const input = normalizeGenerationInput({
      name: "  상품  ",
      keywords: [" 키워드 ", "", "리뷰"],
      summary: " 요약 ",
      tone: "community_comment",
    });

    expect(input).toEqual({
      name: "상품",
      keywords: ["키워드", "리뷰"],
      summary: "요약",
      tone: "community_comment",
    });
    expect(validateGenerationInput(input)).toBeNull();
  });

  it("rejects unsafe blog image metadata", () => {
    const input = normalizeGenerationInput({
      name: "상품",
      keywords: ["키워드"],
      summary: "요약",
      tone: "blog",
      blogImages: [
        {
          label: "bad <label>",
          cloudinaryPublicId: "ovms/blog-images/a",
          displayUrl: "https://res.cloudinary.com/demo/image/upload/a.jpg",
          sourceUrl: "https://res.cloudinary.com/demo/image/upload/a.jpg",
        },
      ],
    });

    expect(validateGenerationInput(input)).toBe("블로그 이미지 라벨을 올바르게 입력해 주세요.");
  });

  it("removes generated image markdown for unapproved URLs", () => {
    const text = [
      "본문",
      "![ok](https://res.cloudinary.com/demo/image/upload/ok.jpg)",
      "![bad](https://example.com/bad.jpg)",
      "image://product",
    ].join("\n");

    const sanitized = sanitizeGeneratedTextImages(text, {
      name: "상품",
      keywords: ["키워드"],
      summary: "요약",
      tone: "blog",
      blogImages: [
        {
          id: "ok",
          label: "ok",
          cloudinaryPublicId: "ok",
          sourceUrl: "https://res.cloudinary.com/demo/image/upload/ok.jpg",
          displayUrl: "https://res.cloudinary.com/demo/image/upload/ok.jpg",
        },
      ],
    });

    expect(sanitized).toContain("![ok]");
    expect(sanitized).not.toContain("example.com");
    expect(sanitized).not.toContain("image://product");
  });
});
