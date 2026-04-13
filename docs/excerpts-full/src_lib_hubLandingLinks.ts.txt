/**
 * 허브/상세 랜딩 링크 생성 규칙.
 *
 * - 상세 랜딩이 열려 있으면(is_landing_enabled / landing_enabled && slug):
 *   /destinations/[slug], /themes/[slug], /recommended/[slug]
 * - 아니면 fallback: /products?region=..., /products?theme=..., /recommended 또는 /products
 *
 * 상세 랜딩 URL은 DB의 slug 컬럼이 있을 때만 사용 (get*BySlug 조회 가능하도록).
 */

import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { HomeCuratedSection } from "@/types/homeCurated";
import { isLandingEnabled, isRecommendedLandingEnabled, hasValidSlug } from "@/lib/hubVisibility";

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * destination(지역) 항목 카드 클릭 시 이동 URL.
 * is_landing_enabled && slug 있으면 /destinations/[slug], 아니면 /products/region/[slug] 또는 /products?region=...
 */
export function getDestinationLandingHref(d: ProductTaxonomy): string {
  const rawSlug = d.slug?.trim();
  const slug = rawSlug ? normalizeSlug(rawSlug) : null;
  const nameSlug = d.name.trim() ? normalizeSlug(d.name) : "";

  if (slug && hasValidSlug(slug) && isLandingEnabled(d)) {
    return `/destinations/${encodeURIComponent(slug)}`;
  }
  if (slug) return `/products/region/${encodeURIComponent(slug)}`;
  if (nameSlug) return `/products/region/${encodeURIComponent(nameSlug)}`;
  return `/products?region=${encodeURIComponent(d.name)}`;
}

/**
 * theme 항목 카드 클릭 시 이동 URL.
 * is_landing_enabled && slug 있으면 /themes/[slug], 아니면 /products/theme/[slug] 또는 /products?theme=...
 */
export function getThemeLandingHref(t: ProductTaxonomy): string {
  const rawSlug = t.slug?.trim();
  const slug = rawSlug ? normalizeSlug(rawSlug) : null;
  const nameSlug = t.name.trim() ? normalizeSlug(t.name) : "";

  if (slug && hasValidSlug(slug) && isLandingEnabled(t)) {
    return `/themes/${encodeURIComponent(slug)}`;
  }
  if (slug) return `/products/theme/${encodeURIComponent(slug)}`;
  if (nameSlug) return `/products/theme/${encodeURIComponent(nameSlug)}`;
  return `/products?theme=${encodeURIComponent(t.name)}`;
}

/**
 * 추천 섹션 항목 클릭 시 이동 URL.
 * landing_enabled && slug 있으면 /recommended/[slug], 아니면 허브(/recommended) 또는 /products.
 */
export function getRecommendedLandingHref(section: HomeCuratedSection): string {
  const rawSlug = section.slug?.trim();
  const slug = rawSlug ? rawSlug.toLowerCase().replace(/\s+/g, "-") : "";
  if (slug && isRecommendedLandingEnabled(section)) {
    return `/recommended/${encodeURIComponent(slug)}`;
  }
  return "/recommended";
}

/**
 * 상품군(product_line) 항목 클릭 시 이동 URL.
 * 상세 랜딩 없음 → /products?product_line=name (필터 연결).
 */
export function getProductLineLandingHref(t: ProductTaxonomy): string {
  const name = (t.name ?? "").trim();
  if (!name) return "/products";
  return `/products?product_line=${encodeURIComponent(name)}`;
}

/** @deprecated getDestinationLandingHref 사용 권장 */
export function buildDestinationHubHref(d: ProductTaxonomy): string {
  return getDestinationLandingHref(d);
}

/** @deprecated getThemeLandingHref 사용 권장 */
export function buildThemeHubHref(t: ProductTaxonomy): string {
  return getThemeLandingHref(t);
}
