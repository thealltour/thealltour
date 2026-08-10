import { describe, expect, it } from "vitest";
import { getOAuthRedirectUri } from "@/lib/auth/redirect";

describe("getOAuthRedirectUri", () => {
  it("builds kakao callback under APP_URL", () => {
    const prev = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = "https://theallcloud.com";
    expect(getOAuthRedirectUri("kakao")).toBe("https://theallcloud.com/api/auth/kakao/callback");
    process.env.NEXT_PUBLIC_APP_URL = prev;
  });
});
