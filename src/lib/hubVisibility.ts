import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { HomeCuratedSection } from "@/types/homeCurated";

/**
 * 허브 노출 vs 상세 랜딩 공개 조건 분리.
 * - 허브 노출: is_active && is_hub_visible 만 사용. is_landing_enabled 는 허브 조회에 사용하지 않음.
 * - 상세 랜딩 공개: is_active && is_landing_enabled. /destinations/[slug], /themes/[slug] 등에서만 사용.
 */

/** 지역/테마: 허브 페이지에 카드 노출 여부. is_active && is_hub_visible */
export function isHubVisible(item: ProductTaxonomy): boolean {
  return Boolean(item.is_active && item.is_hub_visible);
}

/** 지역/테마: 상세 랜딩 페이지 공개 여부. is_active && is_landing_enabled */
export function isLandingEnabled(item: ProductTaxonomy): boolean {
  return Boolean(item.is_active && item.is_landing_enabled);
}

/** 추천 섹션: 상세 랜딩 페이지 공개 여부. landing_enabled 플래그 */
export function isRecommendedLandingEnabled(section: HomeCuratedSection): boolean {
  return section.landing_enabled === true;
}

/** slug가 상세 랜딩 URL에 쓸 수 있는지 (비어 있지 않고 URL-safe) */
export function hasValidSlug(slug: string | null | undefined): boolean {
  const s = typeof slug === "string" ? slug.trim() : "";
  return s.length > 0;
}
