import { describe, expect, it } from "vitest";
import { getOAuthRedirectUri } from "@/lib/auth/redirect";

describe("getOAuthRedirectUri", () => {
  it("builds google callback under APP_URL", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://theallcloud.com";
    expect(getOAuthRedirectUri("google")).toBe("https://theallcloud.com/api/auth/google/callback");
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });

  it("prefers SITE_URL (apex) for kakao even if APP_URL is set to a different host", () => {
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://www.thealltour.com";
    process.env.NEXT_PUBLIC_SITE_URL = "https://thealltour.com";
    // 카카오 디벨로퍼스에는 apex(thealltour.com) 하나만 등록 가능 — www가 섞이면
    // 동의 완료 시점 redirect_uri 불일치로 콜백이 호출되지 않고 조용히 실패한다.
    expect(getOAuthRedirectUri("kakao")).toBe("https://thealltour.com/api/auth/kakao/callback");
    process.env.NEXT_PUBLIC_APP_URL = prevApp;
    process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  });

  it("falls back to APP_URL for kakao if SITE_URL is unset", () => {
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://theallcloud.com";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getOAuthRedirectUri("kakao")).toBe("https://theallcloud.com/api/auth/kakao/callback");
    process.env.NEXT_PUBLIC_APP_URL = prevApp;
    process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  });
});
