import { describe, expect, it } from "vitest";
import {
  parseKakaoMomentCreativeCsv,
  parseMomentNumber,
  splitCsvLine,
} from "@/lib/adminLandings/kakaoMomentCsv";
import { extractUtmFromMetadata, utmBreakdownKey } from "@/lib/adminLandings/landingUtmExtract";

describe("parseMomentNumber", () => {
  it("strips commas and percent", () => {
    expect(parseMomentNumber("27,750")).toBe(27750);
    expect(parseMomentNumber("0.153%")).toBe(0.153);
    expect(parseMomentNumber("-")).toBe(0);
  });
});

describe("splitCsvLine", () => {
  it("splits tabs", () => {
    expect(splitCsvLine("a\tb\tc", "\t")).toEqual(["a", "b", "c"]);
  });

  it("handles quoted commas", () => {
    expect(splitCsvLine('"a,b",c', ",")).toEqual(["a,b", "c"]);
  });
});

describe("parseKakaoMomentCreativeCsv", () => {
  const header =
    "소재\t소재 ID\t상태\t심사 상태\t상위 광고그룹\t상위 광고그룹 ID\t상위 캠페인\t상위 캠페인 ID\t비용\t노출수\t클릭수\t클릭률\t도달수\t클릭당 비용";
  const row =
    "카카오 비즈보드_방문_테스트\t31129074\t운영 불가\t심사 승인\t비즈보드 방문\t4483714\t비즈보드 방문 시즌특가\t1614504\t27750\t72354\t111\t0.153\t54010\t250";

  it("parses tab-separated Moment creative report", () => {
    const result = parseKakaoMomentCreativeCsv(`${header}\n${row}`);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]!.creativeName).toContain("비즈보드");
    expect(result.rows[0]!.cost).toBe(27750);
    expect(result.rows[0]!.impressions).toBe(72354);
    expect(result.rows[0]!.clicks).toBe(111);
    expect(result.rows[0]!.ctr).toBeCloseTo(111 / 72354, 6);
    expect(result.rows[0]!.cpc).toBeCloseTo(27750 / 111, 4);
    expect(result.summary.totalCost).toBe(27750);
    expect(result.summary.totalClicks).toBe(111);
  });

  it("throws on empty", () => {
    expect(() => parseKakaoMomentCreativeCsv("")).toThrow(/비어/);
  });
});

describe("extractUtmFromMetadata", () => {
  it("reads flat utm keys", () => {
    expect(
      extractUtmFromMetadata({
        utm_source: "kakao",
        utm_medium: "bizboard",
        utm_campaign: "sync",
      }),
    ).toEqual({
      utmSource: "kakao",
      utmMedium: "bizboard",
      utmCampaign: "sync",
    });
  });

  it("reads nested utm object", () => {
    expect(
      extractUtmFromMetadata({
        utm: { utm_source: "thealltour", utm_medium: "landing", utm_campaign: "golf" },
      }),
    ).toEqual({
      utmSource: "thealltour",
      utmMedium: "landing",
      utmCampaign: "golf",
    });
  });

  it("falls back to unknown", () => {
    const u = extractUtmFromMetadata(null);
    expect(u.utmSource).toBe("(없음)");
    expect(utmBreakdownKey(u)).toContain("(없음)");
  });
});
