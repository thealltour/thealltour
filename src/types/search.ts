/**
 * Hero 검색 자동완성용 추천 아이템 타입.
 */

import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

export type SearchSuggestionType = "destination" | "theme" | "product";

export type SearchSuggestion = {
  id: string;
  type: SearchSuggestionType;
  label: string;
  sublabel?: string | null;
  slug?: string | null;
  imageUrl?: string | null;
  /** 클릭 시 이동할 URL (서버에서 허브/상세 규칙으로 생성) */
  href: string;
};

/** 검색 결과 페이지 정렬 옵션 */
export type SearchSortOption =
  | "relevance"
  | "latest"
  | "price_asc"
  | "price_desc";

/** 검색 결과 페이지 URL/상태 필터 */
export type SearchFilterState = {
  q?: string;
  destination?: string;
  theme?: string;
  product_line?: string;
  sort?: SearchSortOption;
  page?: number;
};

/** 검색 결과 한 페이지 응답 */
export type SearchProductsResult = {
  items: Product[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

/** GET /api/search 응답 (Load More용) */
export type SearchApiResponse = {
  items: Product[];
  page: number;
  totalPages: number;
};

/** searchProducts 호출 파라미터 */
export type SearchProductsParams = {
  q?: string;
  destination?: string | null;
  theme?: string | null;
  product_line?: string | null;
  sort?: SearchSortOption;
  page?: number;
  pageSize?: number;
};

/** 필터 옵션 (결과에서 파생 또는 taxonomy 조회) */
export type SearchFilterOptions = {
  destinations: string[];
  themes: string[];
  productLines: string[];
};

/** 검색 연관 추천 섹션 구분 */
export type SearchRecommendationSectionType = "destination" | "theme" | "product";

/** 검색 추천 데이터 (연관 지역/테마/추천 상품) */
export type SearchRecommendations = {
  destinations: ProductTaxonomy[];
  themes: ProductTaxonomy[];
  products: Product[];
};

/** 검색 추천 생성 시 컨텍스트 (현재 쿼리/필터) */
export type SearchRecommendationContext = {
  q?: string;
  destination?: string | null;
  theme?: string | null;
  product_line?: string | null;
};
