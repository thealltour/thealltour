import { describe, expect, it } from "vitest";
import { modetourImportToDraft } from "@/lib/admin/modetourImport/mapToDraft";
import type { ModetourImportV1 } from "@/types/modetourImport";

function minimalImport(overrides: Partial<ModetourImportV1["product"]> = {}): ModetourImportV1 {
  return {
    version: "modetour-import-v1",
    source: {
      provider: "modetour",
      url: "https://example.com/tour/1",
      fetchedAtISO: "2026-01-01T00:00:00.000Z",
    },
    product: {
      title: "테스트 투어",
      nights: 3,
      days: 4,
      regionText: "동남아",
      ...overrides,
    },
  };
}

describe("modetourImportToDraft canonical fields", () => {
  it("sets duration and category/theme without overview_* mirrors", () => {
    const { draft } = modetourImportToDraft(minimalImport());
    expect(draft.form.duration).toBe("3박4일");
    expect(draft.form.theme).toBe("동남아");
    expect(draft.form.category).toBe("동남아");
    expect(draft.form.overview_duration).toBeUndefined();
    expect(draft.form.overview_region).toBeUndefined();
  });
});
