import { describe, expect, it } from "vitest";
import { resolveOAuthIdentityMatchMode } from "@/lib/auth/oauthIdentityMatch";

describe("resolveOAuthIdentityMatchMode", () => {
  it("uses phone_only for Kakao Sync funnel acquisition", () => {
    expect(
      resolveOAuthIdentityMatchMode({
        utm_source: "kakao",
        utm_medium: "bizboard",
        utm_campaign: "kakao-sync",
        utm_term: null,
        utm_content: null,
        landing_slug: "kakao-sync",
        landing_path: "/golf/kakao-sync",
      }),
    ).toBe("phone_only");

    expect(
      resolveOAuthIdentityMatchMode({
        utm_source: null,
        utm_medium: null,
        utm_campaign: null,
        utm_term: null,
        utm_content: null,
        landing_slug: "hainan-ad",
        landing_path: "/golf/ads/hainan-ad",
      }),
    ).toBe("phone_only");
  });

  it("uses email_then_phone for non-sync OAuth", () => {
    expect(resolveOAuthIdentityMatchMode(null)).toBe("email_then_phone");
    expect(
      resolveOAuthIdentityMatchMode({
        utm_source: "google",
        utm_medium: "cpc",
        utm_campaign: "brand",
        utm_term: null,
        utm_content: null,
        landing_slug: null,
        landing_path: "/login",
      }),
    ).toBe("email_then_phone");
  });
});
