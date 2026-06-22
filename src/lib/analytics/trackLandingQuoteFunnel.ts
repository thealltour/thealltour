/**
 * 랜딩 공개 페이지 → /quote funnel 클라이언트 계측.
 */

import type { AdminLandingDetail } from "@/types/adminLanding";
import type { AnalyticsPayload } from "./types";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "./events";
import { ensureLandingSourcePath, landingSlugFromSourcePath } from "./createAnalyticsPayload";
import { buildGolfLandingAnalyticsMetadata } from "./golfLandingAttribution";
import { trackClientAnalytics } from "./trackEvent";

function mapTaxonomyType(raw: string | null | undefined): AnalyticsPayload["taxonomyType"] {
  const t = raw?.trim();
  if (t === "destination" || t === "theme" || t === "product_line" || t === "category") {
    return t;
  }
  return null;
}

/** 공개 랜딩 조회 1회 */
export function trackLandingView(landing: AdminLandingDetail, sourcePath: string): void {
  const sp = ensureLandingSourcePath(sourcePath, landing.slug);
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.landing_view,
    source: ANALYTICS_SOURCES.recommended_landing,
    pagePath: sp,
    sourcePath: sp,
    landingSlug: landing.slug,
    templateType: landing.templateType ?? null,
    taxonomyType: mapTaxonomyType(landing.sourceTaxonomyType ?? undefined),
    taxonomySlug: landing.sourceTaxonomySlug?.trim() || null,
    taxonomyId: landing.sourceTaxonomyId?.trim() || null,
    metadata: buildGolfLandingAnalyticsMetadata(landing.slug, landing.templateType),
  });
}

/** CTA 클릭 직전 (네비게이션 전) */
export function trackLandingCtaClick(landing: AdminLandingDetail, sourcePath: string): void {
  const sp = ensureLandingSourcePath(sourcePath, landing.slug);
  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.landing_cta_click,
    source: ANALYTICS_SOURCES.recommended_landing,
    pagePath: sp,
    sourcePath: sp,
    landingSlug: landing.slug,
    quoteCategory: landing.quoteCategory?.trim() || null,
    templateType: landing.templateType ?? null,
    taxonomyType: mapTaxonomyType(landing.sourceTaxonomyType ?? undefined),
    taxonomySlug: landing.sourceTaxonomySlug?.trim() || null,
    section: "cta_section",
    metadata: {
      ...buildGolfLandingAnalyticsMetadata(landing.slug, landing.templateType),
      position: "cta_section",
    },
  });
}

export type QuoteAttributionInput = {
  sourcePath?: string | null;
  landingSlug?: string | null;
  quoteCategory?: string | null;
  productId?: string | null;
};

/** /quote 진입 */
export function trackQuoteView(input: QuoteAttributionInput): void {
  const rawPath = input.sourcePath?.trim() || "";
  const landingSlug =
    input.landingSlug?.trim() || landingSlugFromSourcePath(rawPath) || null;
  const sourcePath =
    rawPath || (landingSlug ? ensureLandingSourcePath(null, landingSlug) : "/quote");
  const isGolfLanding =
    landingSlug?.endsWith("-golf-travel") || input.quoteCategory?.trim().endsWith("-golf");

  trackClientAnalytics({
    eventName: ANALYTICS_EVENTS.quote_view,
    source: ANALYTICS_SOURCES.quote_page,
    pagePath: "/quote",
    sourcePath,
    landingSlug,
    quoteCategory: input.quoteCategory?.trim() || null,
    productId: input.productId?.trim() || null,
    metadata: isGolfLanding
      ? buildGolfLandingAnalyticsMetadata(landingSlug ?? "", "destination_golf_consulting")
      : { funnel: "landing_to_quote" },
  });
}
