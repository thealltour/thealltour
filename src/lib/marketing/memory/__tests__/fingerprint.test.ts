import { describe, expect, it } from "vitest";

import { memoryFingerprint } from "@/lib/marketing/memory/memoryFingerprint";

const base = {
  memoryType: "product_knowledge",
  sourceType: "products",
  sourceId: "prod-1",
  title: "다낭",
  content: "효도여행 추천",
};

describe("memoryFingerprint", () => {
  it("returns the same SHA-256 hash for identical inputs", () => {
    expect(memoryFingerprint(base)).toBe(memoryFingerprint({ ...base }));
    expect(memoryFingerprint(base)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("changes when content changes", () => {
    expect(memoryFingerprint({ ...base, content: "허니문 추천" })).not.toBe(memoryFingerprint(base));
  });
});
