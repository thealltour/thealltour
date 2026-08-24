import { describe, expect, it } from "vitest";

import { MemoryValidationError } from "@/lib/marketing/memory/errors";
import {
  buildEmbeddingText,
  normalizeMemoryDocument,
  normalizeMemoryText,
} from "@/lib/marketing/memory/normalization";

describe("normalizeMemoryText", () => {
  it("trims and collapses whitespace without changing Korean spacing meaning", () => {
    expect(normalizeMemoryText("  다낭   효도여행 \t추천  ")).toBe("다낭 효도여행 추천");
  });

  it("unifies CRLF and strips zero-width characters", () => {
    expect(normalizeMemoryText("다낭\r\n\r\n\r\n추천\u200B")).toBe("다낭\n\n추천");
  });

  it("does not force lowercase", () => {
    expect(normalizeMemoryText("Danang Family Tour")).toBe("Danang Family Tour");
  });
});

describe("buildEmbeddingText", () => {
  it("joins title and content with a blank line", () => {
    expect(buildEmbeddingText("다낭", "효도여행 추천")).toBe("다낭\n\n효도여행 추천");
  });

  it("uses content only when title is missing", () => {
    expect(buildEmbeddingText(null, "효도여행 추천")).toBe("효도여행 추천");
  });
});

describe("normalizeMemoryDocument", () => {
  it("rejects empty content", () => {
    expect(() =>
      normalizeMemoryDocument({
        memoryType: "product_knowledge",
        content: "   ",
      }),
    ).toThrow(MemoryValidationError);
  });

  it("builds embedding text from normalized title and content", () => {
    const result = normalizeMemoryDocument({
      memoryType: "product_knowledge",
      title: "  다낭  ",
      content: "  효도여행   추천  ",
    });
    expect(result).not.toHaveProperty("skip");
    if ("skip" in result) return;
    expect(result.embeddingText).toBe("다낭\n\n효도여행 추천");
    expect(result.title).toBe("다낭");
    expect(result.content).toBe("효도여행 추천");
  });
});
