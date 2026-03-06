/**
 * 랜딩 페이지 CTA 클릭 계측용 fire-and-forget 유틸.
 * cta_click 이벤트, source: landing_region | landing_theme. 링크 이동 방해 없음.
 */

import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export type LandingCtaSection = "hero" | "recommended_products" | "bottom_cta";

export type TrackLandingCtaClickParams = {
  section: LandingCtaSection;
  label: string;
  href: string;
  landingType: "region" | "theme";
  taxonomySlug?: string | null;
  taxonomyName?: string | null;
  pagePath?: string | null;
};

/**
 * 랜딩 내 CTA 클릭 시 호출. fire-and-forget, 네비게이션 방해 없음.
 */
export function trackLandingCtaClick(params: TrackLandingCtaClickParams): void {
  try {
    if (typeof window === "undefined") return;
    const source =
      params.landingType === "theme" ? ANALYTICS_SOURCES.landing_theme : ANALYTICS_SOURCES.landing_region;
    const taxonomyType = params.landingType === "theme" ? "theme" : "category";
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.cta_click,
        source,
        section: params.section,
        label: params.label?.trim() || params.href,
        href: params.href,
        pagePath: params.pagePath ?? window.location.pathname,
        deviceType: inferDeviceType(undefined, window.innerWidth),
        taxonomyType,
        taxonomySlug: params.taxonomySlug?.trim() || null,
        taxonomyName: params.taxonomyName?.trim() || null,
      }),
    );
  } catch {
    // no-op
  }
}
