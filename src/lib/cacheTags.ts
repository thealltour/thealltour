/**
 * 캐시 무효화 태그 상수 — 역할별 분리, 충돌 방지.
 * revalidateTag(tag) 시 해당 tag를 쓰는 unstable_cache만 무효화됨.
 *
 * 역할:
 * - PRODUCTS: 상품 목록/상세. 상품·템플릿 변경 시 revalidate.
 * - HOME_CURATED: 홈 추천 섹션. curated 설정/섹션/상품 매핑 변경 시 revalidate.
 * - TAXONOMY: 지역/테마 taxonomy. taxonomy 테이블 변경 시 revalidate.
 * - HEADER_NAV: 헤더 메가메뉴/모바일 메뉴. taxonomy 또는 home-curated 변경 시 함께 revalidate.
 *
 * Revalidate 호출 위치:
 * - taxonomy: product-taxonomies API (POST/PATCH/DELETE) → TAXONOMY + HEADER_NAV
 * - curated: home-curated settings/sections/products API → HOME_CURATED + revalidatePath("/")
 * - products: products API (POST/PATCH/DELETE), terms-templates API → PRODUCTS + revalidatePath("/products", "/products/[id]")
 */

export const CACHE_TAGS = {
  PRODUCTS: "products",
  HOME_CURATED: "home-curated",
  TAXONOMY: "taxonomy",
  HEADER_NAV: "header-nav",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/** revalidateTag 두 번째 인자 (Next 캐시 프로파일) */
export const REVALIDATE_MAX = "max" as const;
