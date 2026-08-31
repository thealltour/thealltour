/** Coupang Partners dynamic banner — issued values (do not change). */
export const COUPANG_BANNER_ID = 1024259;
export const COUPANG_BANNER_ID_SECONDARY = 1024267;
export const COUPANG_TRAVEL_BANNER_IDS = [
  COUPANG_BANNER_ID,
  COUPANG_BANNER_ID_SECONDARY,
] as const;

export const COUPANG_BANNER_TEMPLATE = "carousel" as const;
export const COUPANG_BANNER_TRACKING_CODE = "AF6237449";
export const COUPANG_BANNER_WIDTH = 680;
export const COUPANG_BANNER_HEIGHT = 140;
export const COUPANG_BANNER_TSOURCE = "";

/** 단일 배너 column (mobile) / 2열 grid (desktop) */
export const COUPANG_SECTION_MAX_WIDTH_CLASS = "max-w-[680px] md:max-w-[1400px]";

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
  container?: HTMLElement | string;
  onLoaded?: (hasAd: boolean) => void;
  onDisplayed?: () => void;
  onClicked?: () => void;
};

export function getCoupangBannerConfig(bannerId: number = COUPANG_BANNER_ID): CoupangBannerConfig {
  return {
    id: bannerId,
    template: COUPANG_BANNER_TEMPLATE,
    trackingCode: COUPANG_BANNER_TRACKING_CODE,
    width: String(COUPANG_BANNER_WIDTH),
    height: String(COUPANG_BANNER_HEIGHT),
    tsource: COUPANG_BANNER_TSOURCE,
  };
}

/** g.js가 생성하는 widgets.html URL — g.js 실패 시 동일 위젯 iframe 폴백용 */
export function getCoupangWidgetIframeSrc(bannerId: number = COUPANG_BANNER_ID): string {
  const params = new URLSearchParams({
    id: String(bannerId),
    template: COUPANG_BANNER_TEMPLATE,
    trackingCode: COUPANG_BANNER_TRACKING_CODE,
    subId: "",
    width: String(COUPANG_BANNER_WIDTH),
    height: String(COUPANG_BANNER_HEIGHT),
    tsource: COUPANG_BANNER_TSOURCE,
  });
  return `https://ads-partners.coupang.com/widgets.html?${params.toString()}`;
}
