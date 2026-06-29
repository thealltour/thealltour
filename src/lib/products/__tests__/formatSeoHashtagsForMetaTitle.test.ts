import { describe, expect, it } from "vitest";
import {
  formatSeoHashtagsForMetaTitle,
  normalizeSeoHashtagToken,
} from "@/lib/products/formatSeoHashtagsForMetaTitle";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";

describe("formatSeoHashtagsForMetaTitle", () => {
  it("joins tags with spaces and strips #", () => {
    expect(
      formatSeoHashtagsForMetaTitle([
        "#아름다운풍경속여행",
        "특별한추억만들기",
        "#특별한추억만들기",
      ]),
    ).toBe("아름다운풍경속여행 특별한추억만들기");
  });

  it("returns null for empty input", () => {
    expect(formatSeoHashtagsForMetaTitle([])).toBeNull();
    expect(formatSeoHashtagsForMetaTitle(undefined)).toBeNull();
  });
});

describe("normalizeSeoHashtagToken", () => {
  it("strips leading hash marks", () => {
    expect(normalizeSeoHashtagToken("##태그")).toBe("태그");
  });
});

describe("parseMetaTitleAsHashtags", () => {
  it("parses hash-prefixed tokens", () => {
    expect(parseMetaTitleAsHashtags("#아름다운풍경속여행 #특별한추억만들기")).toEqual([
      "아름다운풍경속여행",
      "특별한추억만들기",
    ]);
  });

  it("keeps space-separated keywords", () => {
    expect(parseMetaTitleAsHashtags("태국 파크골프 치앙마이")).toEqual([
      "태국",
      "파크골프",
      "치앙마이",
    ]);
  });
});
