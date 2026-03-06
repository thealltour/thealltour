/**
 * 상품 카드 클릭 계측용 fire-and-forget 유틸.
 * Link 이동을 막지 않고, 내부에서 trackClientEvent 사용. throw 금지.
 */

import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, normalizeAnalyticsLabel } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

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
