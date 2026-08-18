import { describe, expect, it } from "vitest";
import {
  SEO_META_TITLE_MAX_TAGS,
  normalizeSeoMetaTitleKeywords,
} from "@/lib/products/seoMetaTitleAi";

describe("normalizeSeoMetaTitleKeywords", () => {
  it("strips hashes and joins with spaces", () => {
    expect(normalizeSeoMetaTitleKeywords("#골프 #제주72홀")).toBe("골프 제주72홀");
    expect(normalizeSeoMetaTitleKeywords(["#골프", "제주"])).toBe("골프 제주");
  });

  it("keeps at most 8 tokens", () => {
    const tags = ["서울", "제주", "골프", "72홀", "특가", "가족", "휴양", "직항", "추가", "버림"];
    const out = normalizeSeoMetaTitleKeywords(tags);
    expect(out?.split(" ")).toHaveLength(SEO_META_TITLE_MAX_TAGS);
    expect(out).toBe("서울 제주 골프 72홀 특가 가족 휴양 직항");
  });

  it("returns null for empty input", () => {
    expect(normalizeSeoMetaTitleKeywords(null)).toBeNull();
    expect(normalizeSeoMetaTitleKeywords("")).toBeNull();
    expect(normalizeSeoMetaTitleKeywords([])).toBeNull();
  });
});
