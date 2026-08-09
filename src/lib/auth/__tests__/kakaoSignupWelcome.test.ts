import { describe, expect, it } from "vitest";
import {
  KAKAO_SIGNUP_WELCOME_POINTS,
  KAKAO_WELCOME_MYPAGE_PATH,
  resolveKakaoWelcomeNextPath,
} from "@/lib/auth/kakaoSignupWelcome";

describe("kakaoSignupWelcome", () => {
  it("exposes welcome point amount", () => {
    expect(KAKAO_SIGNUP_WELCOME_POINTS).toBe(50_000);
  });

  it("resolves /mypage to dashboard welcome path", () => {
    expect(resolveKakaoWelcomeNextPath("/mypage")).toBe(KAKAO_WELCOME_MYPAGE_PATH);
    expect(resolveKakaoWelcomeNextPath("/mypage?tab=points")).toBe(KAKAO_WELCOME_MYPAGE_PATH);
  });

  it("appends welcome query to custom internal paths", () => {
    expect(resolveKakaoWelcomeNextPath("/products/abc")).toBe("/products/abc?welcome_kakao_points=1");
    expect(resolveKakaoWelcomeNextPath("/products/abc?ref=1")).toBe(
      "/products/abc?ref=1&welcome_kakao_points=1",
    );
  });
});
