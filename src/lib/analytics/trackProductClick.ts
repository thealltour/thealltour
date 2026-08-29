/**
 * 상품 카드 클릭 계측용 fire-and-forget 유틸.
 * Link 이동을 막지 않고, 내부에서 trackClientEvent 사용. throw 금지.
 */

import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, normalizeAnalyticsLabel } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export type ProductDetailCtaSection = "top" | "sticky_mobile" | "sidebar";
export type ProductDetailCtaType = "primary" | "kakao";

export type TrackProductDetailCtaClickParams = {
  productId: string;
  ctaType: ProductDetailCtaType;
  section: ProductDetailCtaSection;
  status?: string;
  hasPrice?: boolean;
  pagePath?: string;
};

export type ProductCardClickSource = "home_curated" | "landing" | "product_list";

export type TrackProductCardClickParams = {
  productId: string;
  productTitle: string;
  href: string;
  source: ProductCardClickSource;
  section?: string | null;
  /** landing일 때 region | theme */
  landingType?: "region" | "theme" | null;
  taxonomySlug?: string | null;
  pagePath?: string;
};

import type { AnalyticsSource } from "@/lib/analytics/types";

function resolveSource(
  source: ProductCardClickSource,
  landingType?: "region" | "theme" | null,
): AnalyticsSource {
  if (source === "home_curated") return ANALYTICS_SOURCES.home_curated_section;
  if (source === "product_list") return ANALYTICS_SOURCES.products_catalog;
  if (source === "landing" && landingType === "theme") return ANALYTICS_SOURCES.landing_theme;
  return ANALYTICS_SOURCES.landing_region;
}

/**
 * 상품 카드 클릭 시 호출. fire-and-forget, 네비게이션 방해 없음.
 * TODO(CTR 계측): landing 클릭 시 `landingType` / `taxonomySlug`를 ProductCard에서 넘기면
 * 소스가 landing_region으로만 묶이는 문제를 줄일 수 있음 (스키마 확장은 후속 PR).
 */
export function trackProductCardClick(params: TrackProductCardClickParams): void {
  try {
    const source = resolveSource(params.source, params.landingType);
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    const label = normalizeAnalyticsLabel(params.productTitle || params.productId || "");
    const href =
      typeof params.href === "string" && params.href.length > 0
        ? params.href
        : `/products/${encodeURIComponent(params.productId)}`;

    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_card_click,
        source,
        pagePath,
        productId: params.productId?.trim() || null,
        label: label || null,
        href,
        section: typeof params.section === "string" && params.section.trim() ? params.section.trim() : null,
        taxonomyType: params.source === "landing" && params.landingType === "theme" ? "theme" : null,
        taxonomySlug: typeof params.taxonomySlug === "string" && params.taxonomySlug.trim() ? params.taxonomySlug.trim() : null,
      }),
    );
  } catch {
    // no-op: tracking 실패가 클릭/이동을 막지 않음
  }
}

export type TrackProductDetailViewParams = {
  productId: string;
  tourType?: string | null;
  region?: string | null;
  bookingUxMode?: string | null;
  benefitMode?: string | null;
  pagePath?: string;
};

/**
 * 상품 상세 진입 view (PR-UI-06). 한 번만 fire하도록 호출측에서 관리.
 */
export function trackProductDetailViewSummary(params: TrackProductDetailViewParams): void {
  try {
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_detail_view_summary,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId: params.productId?.trim() || null,
        section: "product_detail",
        label: params.tourType ?? null,
        metadata: {
          tour_type: params.tourType ?? null,
          region: params.region ?? null,
          booking_ux_mode: params.bookingUxMode ?? null,
          benefit_mode: params.benefitMode ?? null,
        },
      }),
    );
  } catch {
    // no-op
  }
}

/**
 * 상품 상세 CTA 클릭 시 호출 (PR18). section = top | sticky_mobile | sidebar.
 */
export function trackProductDetailCtaClick(params: TrackProductDetailCtaClickParams): void {
  try {
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_detail_cta_click,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId: params.productId?.trim() || null,
        section: params.section,
        label: params.ctaType,
        metadata: {
          cta_type: params.ctaType,
          section: params.section,
          status: params.status ?? null,
          has_price: params.hasPrice ?? null,
        },
      }),
    );
  } catch {
    // no-op
  }
}

/** 일정 Day 탭/네비 클릭 (PR20) */
export type TrackProductItineraryDayClickParams = {
  productId: string;
  dayIndex: number;
  dayLabel: string;
  source: "sticky_nav" | "tabs";
  pagePath?: string;
};

export function trackProductItineraryDayClick(params: TrackProductItineraryDayClickParams): void {
  try {
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_itinerary_day_click,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId: params.productId?.trim() || null,
        section: params.source,
        label: params.dayLabel,
        metadata: { day_index: params.dayIndex, source: params.source },
      }),
    );
  } catch {
    // no-op
  }
}

/** 일정 이미지 확대 보기 (PR20) */
export type TrackProductItineraryImageOpenParams = {
  productId: string;
  dayIndex: number;
  eventIndex: number;
  imageIndex: number;
  pagePath?: string;
};

export function trackProductItineraryImageOpen(params: TrackProductItineraryImageOpenParams): void {
  try {
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_itinerary_image_open,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId: params.productId?.trim() || null,
        section: "itinerary",
        label: null,
        metadata: {
          day_index: params.dayIndex,
          event_index: params.eventIndex,
          image_index: params.imageIndex,
        },
      }),
    );
  } catch {
    // no-op
  }
}

/** 일정 하단 CTA 클릭 (PR20) */
export type TrackProductItineraryCtaClickParams = {
  productId: string;
  dayIndex?: number;
  ctaType: "primary" | "kakao";
  pagePath?: string;
};

export function trackProductItineraryCtaClick(params: TrackProductItineraryCtaClickParams): void {
  try {
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_itinerary_cta_click,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId: params.productId?.trim() || null,
        section: "itinerary_bottom",
        label: params.ctaType,
        metadata: {
          cta_type: params.ctaType,
          day_index: params.dayIndex ?? null,
        },
      }),
    );
  } catch {
    // no-op
  }
}

/** CTA 통합 계측 (PR21): section = top | sticky | itinerary */
export type TrackProductCtaClickParams = {
  productId: string;
  ctaType: "primary" | "kakao";
  section: "top" | "sticky" | "itinerary";
  pagePath?: string;
};

export function trackProductCtaClick(params: TrackProductCtaClickParams): void {
  try {
    const pagePath =
      typeof params.pagePath === "string" && params.pagePath.trim()
        ? params.pagePath
        : typeof window !== "undefined"
          ? window.location.pathname
          : null;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.product_cta_click,
        source: ANALYTICS_SOURCES.consult_cta,
        pagePath,
        productId: params.productId?.trim() || null,
        section: params.section,
        label: params.ctaType,
        metadata: { cta_type: params.ctaType, section: params.section },
      }),
    );
  } catch {
    // no-op
  }
}
