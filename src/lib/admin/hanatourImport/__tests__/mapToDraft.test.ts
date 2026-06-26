import { describe, expect, it } from "vitest";
import { hanatourImportToDraft } from "@/lib/admin/hanatourImport/mapToDraft";
import type { HanatourImportV1 } from "@/types/hanatourImport";

function minimalImport(overrides: Partial<HanatourImportV1["product"]> = {}): HanatourImportV1 {
  return {
    version: "hanatour-import-v1",
    source: {
      provider: "hanatour",
      url: "https://www.hanatour.com/trp/pkg/TEST?pkgCd=CGP123",
      fetchedAtISO: "2026-01-01T00:00:00.000Z",
      pkgCd: "CGP123",
    },
    product: {
      title: "테스트 하나투어",
      nights: 3,
      days: 4,
      regionText: "동남아",
      ...overrides,
    },
  };
}

describe("hanatourImportToDraft", () => {
  it("sets duration and category/theme from product fields", () => {
    const { draft } = hanatourImportToDraft(minimalImport());
    expect(draft.form.duration).toBe("3박4일");
    expect(draft.form.theme).toBe("동남아");
    expect(draft.form.category).toBe("동남아");
    expect(draft.form.product_source_url).toContain("hanatour.com");
  });

  it("maps pkgCd from source into product_source_url context", () => {
    const { draft } = hanatourImportToDraft(minimalImport());
    expect(draft.form.title).toBe("테스트 하나투어");
  });
});
