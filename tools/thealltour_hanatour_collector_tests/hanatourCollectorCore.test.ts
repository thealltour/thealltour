import { readFileSync } from "node:fs";
import path from "node:path";
import { runInThisContext } from "node:vm";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

// MV3 확장 폴더 안에 __tests__ 등 _ 로 시작하는 디렉터리를 두면 Chrome 로드가 거부된다.
const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "thealltour_hanatour_collector");

type CollectorCore = {
  parseProductCodesFromHref: (href: string) => {
    saleProdCd: string | null;
    rprsProdCd: string | null;
    depDay: string | null;
  };
  isHanatourProductPageUrl: (href: string) => boolean;
  buildYearMonthRange: (startDate: Date, monthSpan?: number) => {
    strtYearMonth: string;
    endYearMonth: string;
  };
  normalizeYearMonthCalJson: (json: unknown) => Record<string, Array<{ depDay: string; adtAmt?: string }>> | null;
  resolveSearchCalendarFromApiResponse: (json: unknown) => Record<string, Array<{ depDay: string; adtAmt?: string }>> | null;
  buildHanatourCalendarPayload: (
    prodCode: string | null,
    calApiResponse: unknown,
  ) => { rprsProdCd: string | null; searchCalendar?: Record<string, Array<{ depDay: string; adtAmt?: string }>> };
  countSearchCalendarDays: (cal: Record<string, unknown[]> | null) => number;
  buildCleanHtmlStructure: (parts: Record<string, string>) => string;
  uniqueGalleryUrls: (urls: string[]) => string[];
};

function loadCore(): CollectorCore {
  runInThisContext(readFileSync(path.join(extDir, "hanatourCollectorCore.js"), "utf8"), {
    filename: "hanatourCollectorCore.js",
  });
  const api = (globalThis as { HanatourCollectorCore?: CollectorCore }).HanatourCollectorCore;
  if (!api) throw new Error("HanatourCollectorCore was not exported");
  return api;
}

describe("HanatourCollectorCore product URL parsing", () => {
  it("reads rprsProdCds (plural) from major-products query strings", () => {
    const { parseProductCodesFromHref } = loadCore();
    const codes = parseProductCodesFromHref(
      "https://www.hanatour.com/package/major-products?rprsProdCds=MPA1114&strtDepDay=20260801",
    );
    expect(codes.rprsProdCd).toBe("MPA1114");
    expect(codes.saleProdCd).toBeNull();
  });

  it("reads selectedRprsProd and takes the first token of a comma-separated list", () => {
    const { parseProductCodesFromHref } = loadCore();
    const codes = parseProductCodesFromHref(
      "https://www.hanatour.com/trp/pkg/x?selectedRprsProd=AAA,BBB&pkgCd=PAP101260827OZ3",
    );
    expect(codes.rprsProdCd).toBe("AAA");
    expect(codes.saleProdCd).toBe("PAP101260827OZ3");
  });

  it("treats /trp/pkg/ and pkgCd as product pages, not search-only URLs", () => {
    const { isHanatourProductPageUrl } = loadCore();
    expect(
      isHanatourProductPageUrl(
        "https://www.hanatour.com/trp/pkg/CHPC0PKG0200M200?pkgCd=PAP101260827OZ3",
      ),
    ).toBe(true);
    expect(
      isHanatourProductPageUrl(
        "https://www.hanatour.com/package/major-products?rprsProdCds=MPA1114",
      ),
    ).toBe(false);
  });
});

describe("HanatourCollectorCore year-month range", () => {
  it("computes endYearMonth 12 months after the start month, not a hardcoded value", () => {
    const { buildYearMonthRange } = loadCore();
    const range = buildYearMonthRange(new Date(2026, 7, 19), 12);
    expect(range.strtYearMonth).toBe("202608");
    expect(range.endYearMonth).toBe("202708");
  });
});

describe("HanatourCollectorCore calendar JSON normalize", () => {
  it("accepts data as a YYYYMM → days map", () => {
    const { normalizeYearMonthCalJson, countSearchCalendarDays } = loadCore();
    const cal = normalizeYearMonthCalJson({
      data: {
        "202608": [{ depDay: "20260801", adtAmt: "2649000" }],
        "202609": [{ depDay: "20260915", adtAmt: "2700000" }],
      },
    });
    expect(cal?.["202608"][0].depDay).toBe("20260801");
    expect(countSearchCalendarDays(cal)).toBe(2);
  });

  it("accepts calList arrays and searchCalendar wrappers", () => {
    const { normalizeYearMonthCalJson } = loadCore();
    const fromList = normalizeYearMonthCalJson({
      calList: [{ depDay: "20261004", adtAmt: "1000000" }],
    });
    expect(fromList?.["202610"][0].adtAmt).toBe("1000000");

    const wrapped = normalizeYearMonthCalJson({
      data: { searchCalendar: { "202611": [{ depDay: "20261101" }] } },
    });
    expect(wrapped?.["202611"][0].depDay).toBe("20261101");
  });

  it("returns null when nothing looks like a calendar", () => {
    const { normalizeYearMonthCalJson } = loadCore();
    expect(normalizeYearMonthCalJson({ message: "ok" })).toBeNull();
  });

  it("resolveSearchCalendarFromApiResponse prefers data then calList", () => {
    const { resolveSearchCalendarFromApiResponse, buildHanatourCalendarPayload } = loadCore();
    const fromData = resolveSearchCalendarFromApiResponse({
      data: {
        "202608": [{ depDay: "20260801", adtAmt: "1000000" }],
      },
    });
    expect(fromData?.["202608"][0].depDay).toBe("20260801");

    const fromCalList = resolveSearchCalendarFromApiResponse({
      calList: [{ depDay: "20260915", adtAmt: "2000000" }],
    });
    expect(fromCalList?.["202609"][0].depDay).toBe("20260915");

    const payload = buildHanatourCalendarPayload("MPA1114", {
      data: { "202608": [{ depDay: "20260801", adtAmt: "1000000" }] },
    });
    expect(payload.rprsProdCd).toBe("MPA1114");
    expect(payload.searchCalendar?.["202608"][0].depDay).toBe("20260801");
  });
});

describe("HanatourCollectorCore light scrape helpers", () => {
  it("keeps hanatour image hosts and drops others", () => {
    const { uniqueGalleryUrls } = loadCore();
    expect(
      uniqueGalleryUrls([
        "https://image.hanatour.com/a.jpg",
        "https://static.hanatour.com/b.jpg",
        "https://example.com/x.jpg",
        "https://image.hanatour.com/a.jpg",
      ]),
    ).toEqual(["https://image.hanatour.com/a.jpg", "https://static.hanatour.com/b.jpg"]);
  });

  it("builds cleanHtmlStructure from innerText plus meta tags", () => {
    const { buildCleanHtmlStructure } = loadCore();
    const text = buildCleanHtmlStructure({
      ogTitle: "상품명",
      description: "요약",
      ogImage: "https://image.hanatour.com/hero.jpg",
      innerText: "본문",
    });
    expect(text).toContain("[og:title]");
    expect(text).toContain("본문");
  });
});
