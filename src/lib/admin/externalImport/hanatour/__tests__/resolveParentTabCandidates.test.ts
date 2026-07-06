import { describe, expect, it } from "vitest";

import {
  isHanatourDetailPageUrl,
  isHanatourSearchPageUrl,
  resolveParentTabCandidates,
} from "@/lib/admin/externalImport/hanatour/resolveParentTabCandidates";

describe("resolveParentTabCandidates", () => {
  it("prefers mapped parent then opener then left tabs (nearest first)", () => {
    const child = { id: 30, index: 3, openerTabId: 20 };
    const siblings = [
      { id: 10, index: 0 },
      { id: 20, index: 1 },
      { id: 25, index: 2 },
      { id: 30, index: 3 },
      { id: 40, index: 4 },
    ];
    expect(resolveParentTabCandidates(child, siblings, 15)).toEqual([15, 20, 25, 10]);
  });

  it("dedupes opener when same as mapped parent", () => {
    const child = { id: 30, index: 2, openerTabId: 20 };
    const siblings = [
      { id: 20, index: 0 },
      { id: 30, index: 2 },
    ];
    expect(resolveParentTabCandidates(child, siblings, 20)).toEqual([20]);
  });

  it("returns empty when no candidates", () => {
    expect(resolveParentTabCandidates({ id: 1, index: 0 }, [{ id: 1, index: 0 }])).toEqual([]);
  });
});

describe("isHanatourSearchPageUrl", () => {
  it("matches all-search keyword pages", () => {
    expect(
      isHanatourSearchPageUrl(
        "https://www.hanatour.com/all-search?keyword=대구출발&keywordCateg=DS",
      ),
    ).toBe(true);
  });

  it("matches legacy search paths", () => {
    expect(isHanatourSearchPageUrl("https://www.hanatour.com/search?keyword=test")).toBe(true);
  });
});

describe("isHanatourDetailPageUrl", () => {
  it("matches trp/pkg detail URLs", () => {
    expect(
      isHanatourDetailPageUrl(
        "https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=CGP6262609277CA",
      ),
    ).toBe(true);
  });

  it("matches pkgCd+depDay query pattern", () => {
    expect(
      isHanatourDetailPageUrl(
        "https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=CGP6262609277CA&depDay=20260927&newWin=true",
      ),
    ).toBe(true);
  });
});
