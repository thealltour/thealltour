import { describe, expect, it } from "vitest";
import {
  buildKakaoOAuthFailureMetadata,
  kakaoOAuthFailureAttribution,
  truncateOAuthFailureMessage,
} from "@/lib/analytics/kakaoOAuthFailureMetadata";
import type { MemberAcquisition } from "@/lib/auth/memberAcquisition";

const kakaoSyncAcquisition: MemberAcquisition = {
  utm_source: "kakao",
  utm_medium: "bizboard",
  utm_campaign: "kakao-sync",
  utm_term: null,
  utm_content: null,
  landing_slug: "kakao-sync",
  landing_path: "/golf/kakao-sync",
};

describe("truncateOAuthFailureMessage", () => {
  it("returns null for empty input", () => {
    expect(truncateOAuthFailureMessage(null)).toBeNull();
    expect(truncateOAuthFailureMessage("")).toBeNull();
    expect(truncateOAuthFailureMessage("   ")).toBeNull();
  });

  it("truncates long messages with ellipsis", () => {
    const long = "x".repeat(250);
    const out = truncateOAuthFailureMessage(long);
    expect(out).toHaveLength(201);
    expect(out?.endsWith("…")).toBe(true);
  });
});

describe("buildKakaoOAuthFailureMetadata", () => {
  it("maps oauth_error with error and error_description", () => {
    const meta = buildKakaoOAuthFailureMetadata({
      reason: "oauth_error",
      oauthError: "access_denied",
      oauthErrorDescription: "User denied access",
      acquisition: kakaoSyncAcquisition,
    });
    expect(meta).toMatchObject({
      provider: "kakao",
      reason: "oauth_error",
      oauthError: "access_denied",
      oauthErrorDescription: "User denied access",
      funnel: "kakao_sync",
      acquisition: kakaoSyncAcquisition,
    });
    expect(meta).not.toHaveProperty("message");
  });

  it("maps missing_code without oauthError", () => {
    const meta = buildKakaoOAuthFailureMetadata({
      reason: "missing_code",
      acquisition: kakaoSyncAcquisition,
    });
    expect(meta.reason).toBe("missing_code");
    expect(meta.oauthError).toBeNull();
    expect(meta.oauthErrorDescription).toBeNull();
    expect(meta.funnel).toBe("kakao_sync");
  });

  it("omits funnel when acquisition is not kakao sync", () => {
    const meta = buildKakaoOAuthFailureMetadata({
      reason: "oauth_failed",
      message: "token exchange failed",
      acquisition: {
        ...kakaoSyncAcquisition,
        landing_slug: "other",
        landing_path: "/products",
      },
    });
    expect(meta).not.toHaveProperty("funnel");
    expect(meta.message).toBe("token exchange failed");
  });

  it("omits funnel when acquisition is null", () => {
    const meta = buildKakaoOAuthFailureMetadata({
      reason: "oauth_invalid_state",
      acquisition: null,
    });
    expect(meta).not.toHaveProperty("funnel");
    expect(meta.acquisition).toBeNull();
  });

  it("trims oauth error fields", () => {
    const meta = buildKakaoOAuthFailureMetadata({
      reason: "oauth_error",
      oauthError: "  KOE101  ",
      oauthErrorDescription: "  bad redirect  ",
    });
    expect(meta.oauthError).toBe("KOE101");
    expect(meta.oauthErrorDescription).toBe("bad redirect");
  });
});

describe("kakaoOAuthFailureAttribution", () => {
  it("returns nulls without acquisition", () => {
    expect(kakaoOAuthFailureAttribution(null)).toEqual({
      sourcePath: null,
      landingSlug: null,
    });
  });

  it("maps landing path and slug", () => {
    expect(kakaoOAuthFailureAttribution(kakaoSyncAcquisition)).toEqual({
      sourcePath: "/golf/kakao-sync",
      landingSlug: "kakao-sync",
    });
  });
});
