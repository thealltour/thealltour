import { describe, expect, it } from "vitest";
import { parseMemberAcquisitionFromSearchParams } from "@/lib/auth/memberAcquisition";
import { buildKakaoSyncGolfPublicUrl } from "@/lib/hardcodedLandings/kakaoSyncGolf/urls";
import {
  isKakaoSyncAnalyticsEvent,
  resolveKakaoSyncCampaign,
  shouldCountKakaoSyncAnalyticsEvent,
} from "@/lib/adminLandings/kakaoSyncAnalyticsFilters";
import {
  formatKakaoSyncRate,
  parseKakaoSyncAnalyticsRangeParam,
} from "@/lib/adminLandings/kakaoSyncAnalyticsModels";
import {
  parseKakaoSyncAnalyticsDateParam,
  resolveKakaoSyncAnalyticsWindow,
  toKstYmd,
} from "@/lib/adminLandings/kakaoSyncAnalyticsRange";

describe("parseMemberAcquisitionFromSearchParams", () => {
  it("returns null when empty", () => {
    expect(parseMemberAcquisitionFromSearchParams(new URLSearchParams())).toBeNull();
  });

  it("parses utm and landing fields", () => {
    const params = new URLSearchParams({
      utm_source: "kakao",
      utm_medium: "bizboard",
      utm_campaign: "kakao-sync",
      landing_slug: "kakao-sync",
      landing_path: "/golf/kakao-sync",
    });
    expect(parseMemberAcquisitionFromSearchParams(params)).toEqual({
      utm_source: "kakao",
      utm_medium: "bizboard",
      utm_campaign: "kakao-sync",
      utm_term: null,
      utm_content: null,
      landing_slug: "kakao-sync",
      landing_path: "/golf/kakao-sync",
    });
  });
});

describe("buildKakaoSyncGolfPublicUrl", () => {
  it("includes bizboard utm params", () => {
    const url = buildKakaoSyncGolfPublicUrl(true);
    expect(url).toContain("/golf/kakao-sync?");
    expect(url).toContain("utm_source=kakao");
    expect(url).toContain("utm_medium=bizboard");
    expect(url).toContain("utm_campaign=kakao-sync");
  });
});

describe("kakao sync funnel filters", () => {
  it("detects kakao-sync landing events", () => {
    expect(
      isKakaoSyncAnalyticsEvent({
        template_type: "kakao_sync_golf",
        landing_slug: "kakao-sync",
        source_path: "/golf/kakao-sync",
      }),
    ).toBe(true);
    expect(
      isKakaoSyncAnalyticsEvent({
        template_type: null,
        section: "kakao_sync_golf_landing",
      }),
    ).toBe(true);
    expect(
      isKakaoSyncAnalyticsEvent({
        template_type: "destination_golf_consulting",
        source_path: "/recommended/foo",
      }),
    ).toBe(false);
  });

  it("resolves campaign buckets for funnel table", () => {
    expect(resolveKakaoSyncCampaign({ landing_slug: "kakao-sync", template_type: "kakao_sync_golf" }).key).toBe(
      "kakao-sync",
    );
    expect(resolveKakaoSyncCampaign({ landing_slug: "hainan-ad", template_type: "mobile_golf_ad" }).key).toBe(
      "ads:hainan-ad",
    );
  });

  it("formats rates for KPI cards", () => {
    expect(formatKakaoSyncRate(0)).toBe("0%");
    expect(formatKakaoSyncRate(0.1234)).toBe("12.3%");
  });

  it("counts client landing_view as fallback but excludes client cta", () => {
    expect(
      shouldCountKakaoSyncAnalyticsEvent({
        event_name: "landing_view",
        metadata: { ingest: "client" },
      }),
    ).toBe(true);
    expect(
      shouldCountKakaoSyncAnalyticsEvent({
        event_name: "landing_view",
        metadata: { ingest: "middleware" },
      }),
    ).toBe(true);
    expect(
      shouldCountKakaoSyncAnalyticsEvent({
        event_name: "landing_cta_click",
        metadata: { ingest: "client" },
      }),
    ).toBe(false);
    expect(
      shouldCountKakaoSyncAnalyticsEvent({
        event_name: "landing_cta_click",
        metadata: { ingest: "oauth_start" },
      }),
    ).toBe(true);
  });
});

describe("kakao sync analytics range", () => {
  it("parses range and date params", () => {
    expect(parseKakaoSyncAnalyticsRangeParam("1d")).toBe("1d");
    expect(parseKakaoSyncAnalyticsRangeParam("custom")).toBe("custom");
    expect(parseKakaoSyncAnalyticsRangeParam("nope")).toBe("30d");
    expect(parseKakaoSyncAnalyticsDateParam("2026-08-10")).toBe("2026-08-10");
    expect(parseKakaoSyncAnalyticsDateParam("2026/08/10")).toBeNull();
  });

  it("builds KST custom day window", () => {
    const w = resolveKakaoSyncAnalyticsWindow("custom", "2026-08-10");
    expect(w.trendDates).toEqual(["2026-08-10"]);
    expect(w.since).toBe(new Date("2026-08-10T00:00:00+09:00").toISOString());
    expect(w.until).toBe(new Date("2026-08-10T23:59:59.999+09:00").toISOString());
  });

  it("builds 7d trend with 7 KST dates", () => {
    const w = resolveKakaoSyncAnalyticsWindow("7d");
    expect(w.trendDates).toHaveLength(7);
    expect(w.since).toBeTruthy();
    expect(w.until).toBeTruthy();
  });

  it("maps late UTC night to next KST calendar day", () => {
    // 2026-08-09 15:30 UTC = 2026-08-10 00:30 KST
    expect(toKstYmd("2026-08-09T15:30:00.000Z")).toBe("2026-08-10");
  });
});

describe("kakao sync landing hit helpers", () => {
  it("resolves hardcoded and ads paths", async () => {
    const { resolveKakaoSyncLandingHitTarget, isKakaoSyncFunnelAcquisition } = await import(
      "@/lib/analytics/kakaoSyncLandingHit"
    );
    expect(resolveKakaoSyncLandingHitTarget("/golf/kakao-sync")?.landingSlug).toBe("kakao-sync");
    expect(resolveKakaoSyncLandingHitTarget("/golf/ads/hainan")?.templateType).toBe("mobile_golf_ad");
    expect(resolveKakaoSyncLandingHitTarget("/products")).toBeNull();
    expect(
      isKakaoSyncFunnelAcquisition({ landing_slug: "kakao-sync", landing_path: "/golf/kakao-sync" }),
    ).toBe(true);
    expect(isKakaoSyncFunnelAcquisition({ landing_slug: null, landing_path: null })).toBe(false);
  });
});
