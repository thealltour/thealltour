/** Coupang Partners dynamic banner — issued values (do not change). */
export const COUPANG_BANNER_ID = 1024259;
export const COUPANG_BANNER_TEMPLATE = "carousel" as const;
export const COUPANG_BANNER_TRACKING_CODE = "AF6237449";
export const COUPANG_BANNER_WIDTH = 680;
export const COUPANG_BANNER_HEIGHT = 140;
export const COUPANG_BANNER_TSOURCE = "";

export const COUPANG_GJS_URL = "https://ads-partners.coupang.com/g.js";

export const COUPANG_PARTNERS_DISCLOSURE =
  "이 포스팅은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.";

export type CoupangBannerConfig = {
  id: number;
  template: string;
  trackingCode: string;
  width: string;
  height: string;
  tsource: string;
};

export function getCoupangBannerConfig(): CoupangBannerConfig {
  return {
    id: COUPANG_BANNER_ID,
    template: COUPANG_BANNER_TEMPLATE,
    trackingCode: COUPANG_BANNER_TRACKING_CODE,
    width: String(COUPANG_BANNER_WIDTH),
    height: String(COUPANG_BANNER_HEIGHT),
    tsource: COUPANG_BANNER_TSOURCE,
  };
}
