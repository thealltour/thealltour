import { describe, expect, it } from "vitest";
import { parseMemberAcquisitionFromSearchParams } from "@/lib/auth/memberAcquisition";
import { buildKakaoSyncGolfPublicUrl } from "@/lib/hardcodedLandings/kakaoSyncGolf/urls";
import {
  isKakaoSyncAnalyticsEvent,
  resolveKakaoSyncCampaign,
} from "@/lib/adminLandings/kakaoSyncAnalyticsFilters";
import { formatKakaoSyncRate } from "@/lib/adminLandings/kakaoSyncAnalyticsModels";

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
});
