import { afterEach, describe, expect, it, vi } from "vitest";
import {
  appendKakaoPixelSignupQuery,
  fireKakaoPixelCompleteRegistrationOnce,
  isKakaoPixelEnabled,
  pathHasKakaoPixelSignupQuery,
  resetKakaoPixelCompleteRegistrationGuard,
  shouldFireKakaoPixelCompleteRegistration,
  shouldTrackKakaoPixelPageView,
  withKakaoPixelSignupQuery,
} from "@/lib/analytics/kakaoPixel";

describe("appendKakaoPixelSignupQuery", () => {
  it("keeps existing query and adds kakao_signup=1", () => {
    expect(appendKakaoPixelSignupQuery("/mypage/dashboard")).toBe(
      "/mypage/dashboard?kakao_signup=1",
    );
    expect(appendKakaoPixelSignupQuery("/mypage/dashboard?welcome_kakao_points=1")).toBe(
      "/mypage/dashboard?welcome_kakao_points=1&kakao_signup=1",
    );
    expect(
      appendKakaoPixelSignupQuery("/auth/complete-profile?next=%2Fmypage%2Fdashboard"),
    ).toBe("/auth/complete-profile?next=%2Fmypage%2Fdashboard&kakao_signup=1");
  });
});

describe("withKakaoPixelSignupQuery", () => {
  it("adds the flag only for new Kakao members", () => {
    expect(
      withKakaoPixelSignupQuery({
        provider: "kakao",
        isNewMember: true,
        destination: "/mypage/dashboard",
      }),
    ).toBe("/mypage/dashboard?kakao_signup=1");
    expect(
      withKakaoPixelSignupQuery({
        provider: "kakao",
        isNewMember: false,
        destination: "/mypage/dashboard",
      }),
    ).toBe("/mypage/dashboard");
    expect(
      withKakaoPixelSignupQuery({
        provider: "naver",
        isNewMember: true,
        destination: "/mypage/dashboard",
      }),
    ).toBe("/mypage/dashboard");
  });
});

describe("kakao pixel fire conditions", () => {
  it("skips pageView on admin consoles", () => {
    expect(shouldTrackKakaoPixelPageView("/products")).toBe(true);
    expect(shouldTrackKakaoPixelPageView("/admin/products")).toBe(false);
    expect(shouldTrackKakaoPixelPageView("/theall_manager_only/login")).toBe(false);
  });

  it("does not fire completeRegistration on complete-profile", () => {
    expect(shouldFireKakaoPixelCompleteRegistration("/mypage/dashboard")).toBe(true);
    expect(shouldFireKakaoPixelCompleteRegistration("/auth/complete-profile")).toBe(false);
  });

  it("detects signup query", () => {
    expect(pathHasKakaoPixelSignupQuery("/mypage?kakao_signup=1")).toBe(true);
    expect(pathHasKakaoPixelSignupQuery("/mypage")).toBe(false);
  });

  it("enables on production hosts or explicit env", () => {
    expect(isKakaoPixelEnabled("thealltour.com", "")).toBe(true);
    expect(isKakaoPixelEnabled("www.thealltour.com", "")).toBe(true);
    expect(isKakaoPixelEnabled("localhost", "")).toBe(false);
    expect(isKakaoPixelEnabled("localhost", "true")).toBe(true);
  });
});

describe("fireKakaoPixelCompleteRegistrationOnce", () => {
  afterEach(() => {
    resetKakaoPixelCompleteRegistrationGuard();
    sessionStorage.clear();
    vi.unstubAllEnvs();
  });

  it("sends completeRegistration only once per session", () => {
    vi.stubEnv("NEXT_PUBLIC_KAKAO_PIXEL_ENABLE", "true");
    const completeRegistration = vi.fn();
    window.kakaoPixel = () => ({
      pageView: vi.fn(),
      completeRegistration,
    });

    expect(fireKakaoPixelCompleteRegistrationOnce()).toBe(true);
    expect(fireKakaoPixelCompleteRegistrationOnce()).toBe(false);
    expect(completeRegistration).toHaveBeenCalledTimes(1);
  });
});
