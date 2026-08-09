import { describe, expect, it } from "vitest";
import {
  aggregateKakaoOAuthFailures,
  kakaoOAuthFailureBreakdownKey,
} from "@/lib/adminLandings/kakaoOAuthFailureStats";

describe("kakaoOAuthFailureBreakdownKey", () => {
  it("prefers oauthError when present", () => {
    expect(kakaoOAuthFailureBreakdownKey("oauth_error", "access_denied")).toBe(
      "oauth_error:access_denied",
    );
    expect(kakaoOAuthFailureBreakdownKey("missing_code", null)).toBe("missing_code");
  });
});

describe("aggregateKakaoOAuthFailures", () => {
  it("ignores non-failure events", () => {
    const result = aggregateKakaoOAuthFailures([
      {
        event_name: "kakao_oauth_success",
        metadata: { reason: "oauth_error" },
        occurred_at: "2026-08-01T00:00:00.000Z",
      },
    ]);
    expect(result.breakdown).toEqual([]);
    expect(result.recent).toEqual([]);
  });

  it("groups by reason:oauthError and sorts by count", () => {
    const rows = [
      {
        event_name: "kakao_oauth_failed",
        landing_slug: "kakao-sync",
        source_path: "/golf/kakao-sync",
        metadata: {
          reason: "oauth_error",
          oauthError: "access_denied",
          oauthErrorDescription: "User denied",
        },
        occurred_at: "2026-08-09T10:00:00.000Z",
      },
      {
        event_name: "kakao_oauth_failed",
        metadata: { reason: "oauth_error", oauthError: "access_denied" },
        occurred_at: "2026-08-09T09:00:00.000Z",
      },
      {
        event_name: "kakao_oauth_failed",
        metadata: { reason: "missing_code" },
        occurred_at: "2026-08-09T08:00:00.000Z",
      },
      {
        event_name: "kakao_oauth_failed",
        metadata: { reason: "oauth_failed", message: "boom" },
        occurred_at: "2026-08-09T07:00:00.000Z",
      },
    ];

    const { breakdown, recent } = aggregateKakaoOAuthFailures(rows, { recentLimit: 3 });

    expect(breakdown).toEqual([
      {
        key: "oauth_error:access_denied",
        reason: "oauth_error",
        oauthError: "access_denied",
        count: 2,
      },
      { key: "missing_code", reason: "missing_code", oauthError: null, count: 1 },
      { key: "oauth_failed", reason: "oauth_failed", oauthError: null, count: 1 },
    ]);

    expect(recent).toHaveLength(3);
    expect(recent[0]).toMatchObject({
      occurredAt: "2026-08-09T10:00:00.000Z",
      reason: "oauth_error",
      oauthError: "access_denied",
      oauthErrorDescription: "User denied",
      landingSlug: "kakao-sync",
      sourcePath: "/golf/kakao-sync",
    });
    expect(recent[2].reason).toBe("missing_code");
  });

  it("uses unknown when reason missing", () => {
    const { breakdown } = aggregateKakaoOAuthFailures([
      {
        event_name: "kakao_oauth_failed",
        metadata: {},
        occurred_at: "2026-08-01T00:00:00.000Z",
      },
    ]);
    expect(breakdown[0]?.reason).toBe("unknown");
    expect(breakdown[0]?.key).toBe("unknown");
  });
});
