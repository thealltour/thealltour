/**
 * 분류 축 (PR-TAX-1). type/category_type 조합을 대체.
 * - destination: 지역/국가/권역
 * - theme: 여행 스타일/목적
 * - product_line: 상품군/서비스 라인
 * - campaign: 운영 강조/기획전
 * - tag: 보조 메타(선택)
 */
export type TaxonomyType =
  | "destination"
  | "theme"
  | "product_line"
  | "campaign"
  | "tag";

/** @deprecated taxonomy_type 사용. 하위 호환용 유지 */
export type ProductTaxonomyType = "category" | "theme";

/** @deprecated taxonomy_type 사용. 하위 호환용 유지 */
export type ProductCategoryType =
  | "destination"
  | "product_line"
  | "highlight"
  | "other";

export type ProductTaxonomy = {
  id: string;
  /** 분류 축. 허브/필터는 이 값 기준으로 조회 */
  taxonomy_type: TaxonomyType;
  /** @deprecated taxonomy_type 사용. 하위 호환용 */
  type?: ProductTaxonomyType;
  name: string;
  /** URL-safe. 비어 있으면 name 기반 매칭에 사용 */
  slug: string | null;
  is_active: boolean;
  sort_order: number | null;
  created_at: string | null;
  /** 상위 분류(대분류) id. null이면 최상위(해외/국내 등) */
  parent_id?: string | null;
  /** @deprecated taxonomy_type 사용. 하위 호환용 */
  category_type?: ProductCategoryType | null;
  /** 허브 메뉴(1depth) 노출 여부 */
  is_hub_visible: boolean;
  /** 상세 랜딩 페이지 공개 여부 */
  is_landing_enabled: boolean;
  // --- 선택: 카드/랜딩/SEO (향후 확장)
  card_title?: string | null;
  card_description?: string | null;
  card_image_url?: string | null;
  landing_title?: string | null;
  landing_description?: string | null;
  hero_image_url?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
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

/** 상품 필터 지역 트리 노드 (대분류 > 중분류 > 소분류). */
export type RegionTreeNode = {
  id: string;
  name: string;
  children?: RegionTreeNode[];
};
