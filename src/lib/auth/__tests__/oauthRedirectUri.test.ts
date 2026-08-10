import { describe, expect, it } from "vitest";
import { getOAuthRedirectUri } from "@/lib/auth/redirect";

describe("getOAuthRedirectUri", () => {
  it("builds google callback under APP_URL", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://theallcloud.com";
    expect(getOAuthRedirectUri("google")).toBe("https://theallcloud.com/api/auth/google/callback");
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });

  it("always pins kakao redirect_uri to the registered apex domain, ignoring APP_URL/SITE_URL", () => {
    const prevApp = process.env.NEXT_PUBLIC_APP_URL;
    const prevSite = process.env.NEXT_PUBLIC_SITE_URL;
    // 카카오 디벨로퍼스에는 apex(thealltour.com) 단 1개만 등록 가능 — APP_URL이
    // www 등 다른 값으로 잘못 설정돼도 동의 완료 시점 redirect_uri 불일치로
    // 콜백이 호출되지 않고 조용히 실패하므로, 환경변수와 무관하게 고정해야 한다.
    process.env.NEXT_PUBLIC_APP_URL = "https://www.thealltour.com";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(getOAuthRedirectUri("kakao")).toBe("https://thealltour.com/api/auth/kakao/callback");
    process.env.NEXT_PUBLIC_APP_URL = prevApp;
    process.env.NEXT_PUBLIC_SITE_URL = prevSite;
  });
});
