export type ProductTaxonomyType = "category" | "theme";

export type ProductTaxonomy = {
  id: string;
  type: ProductTaxonomyType;
  name: string;
  /** URL/헤더용. 비어 있으면 name 기반 매칭에 사용 */
  slug: string | null;
  is_active: boolean;
  sort_order: number | null;
  created_at: string | null;
};

export type ProductTaxonomyWithUsage = ProductTaxonomy & {
  usageCount: number;
  /** 최근 7일 헤더/메가메뉴 클릭 수 (관리자 목록용, 선택) */
  headerClickCount?: number;
  /** 최근 7일 검색 유입 수 (관리자 목록용, 선택) */
  searchInboundCount?: number;
  /** 최근 7일 랜딩 조회 수 (관리자 목록용, 선택) */
  landingViewCount?: number;
  /** 랜딩 CTR, landingViewCount > 0일 때만 (관리자 목록용, 선택) */
  landingCtr?: number | null;
};
