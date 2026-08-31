import type { Product } from "@/types/product";

/**
 * URL 목록 `q` 검색과 카탈로그 키워드 검색이 **같은 필드**를 스캔하지만,
 * 토큰화 규칙은 의도적으로 다르다 (2단계에서 통합하지 않음).
 */

/** `applyProductFilters` 의 `q` 와 `productCatalogMatchesKeyword` 가 공유하는 haystack. */
export function buildProductsKeywordHaystack(
  product: Pick<Product, "title" | "category" | "theme"> & { description?: string },
): string {
  return [product.title, product.description ?? "", product.category, product.theme ?? ""]
    .join(" ")
    .toLowerCase();
}

/**
 * 목록 쿼리 `q`: 공백 기준 분리 (`applyProductFilters` 와 동일).
 * 인자는 이미 `trim().toLowerCase()` 된 문자열을 기대한다.
 */
export function tokenizeListingQueryKeyword(keywordLowercasedTrimmed: string): string[] {
  return keywordLowercasedTrimmed.split(/\s+/).filter(Boolean);
}

/**
 * 카탈로그 키워드: 쉼표·공백 복합 분리 (`productCatalogMatchesKeyword` 와 동일).
 * 인자는 `normalizeProductCatalogSearchKeyword` 이후(소문자·trim) 문자열을 기대한다.
 */
export function tokenizeCatalogKeyword(keywordLowercasedTrimmed: string): string[] {
  return keywordLowercasedTrimmed
    .split(/[,\s]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
}
