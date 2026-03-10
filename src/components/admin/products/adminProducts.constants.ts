/**
 * Admin products 도메인 공통 상수
 * view key, query param key, 기본 page size, 메뉴 라벨↔view 매핑
 */

export const ADMIN_PRODUCTS_VIEW = {
  LIST: "list",
  CREATE: "create",
  TAXONOMY: "taxonomy",
  FEATURED: "featured",
  HOME_REGION_CARDS: "home-region-cards",
} as const;

export type AdminProductsViewKey =
  (typeof ADMIN_PRODUCTS_VIEW)[keyof typeof ADMIN_PRODUCTS_VIEW];

export const ADMIN_PRODUCTS_QUERY_KEYS = {
  VIEW: "view",
  EDITING_ID: "editingId",
  PAGE: "page",
  Q: "q",
  SORT_FIELD: "sortField",
  SORT_DIRECTION: "sortDirection",
} as const;

/** 상품 목록 기본 페이지 크기 */
export const DEFAULT_PRODUCTS_PAGE_SIZE = 8;

/** SubHeader 등: 메뉴 라벨 → view param */
export const PRODUCT_LABEL_TO_VIEW: Record<string, AdminProductsViewKey> = {
  "카테고리/테마 관리": ADMIN_PRODUCTS_VIEW.TAXONOMY,
  "메인 추천상품 관리": ADMIN_PRODUCTS_VIEW.FEATURED,
  "메인 지역카드": ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS,
  "상품 등록": ADMIN_PRODUCTS_VIEW.CREATE,
  "상품 목록": ADMIN_PRODUCTS_VIEW.LIST,
};

/** SubHeader 등: view param → 메뉴 라벨 (탭 활성화용) */
export const PRODUCT_VIEW_TO_LABEL: Record<string, string> = {
  [ADMIN_PRODUCTS_VIEW.TAXONOMY]: "카테고리/테마 관리",
  [ADMIN_PRODUCTS_VIEW.FEATURED]: "메인 추천상품 관리",
  [ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS]: "메인 지역카드",
  [ADMIN_PRODUCTS_VIEW.CREATE]: "상품 등록",
  [ADMIN_PRODUCTS_VIEW.LIST]: "상품 목록",
};

/** 반복 사용되는 fallback/에러 문구 (여러 파일에서 동일 문구만) */
export const ADMIN_PRODUCTS_MESSAGES = {
  LIST_FETCH_FAIL: "상품 목록 조회에 실패했습니다.",
  LIST_FETCH_ERROR: "상품 목록 조회 중 오류가 발생했습니다.",
  PRODUCT_FETCH_FAIL: "상품 조회에 실패했습니다.",
  PRODUCT_SAVE_FAIL: "상품 저장에 실패했습니다.",
  PRODUCT_DELETE_FAIL: "상품 삭제에 실패했습니다.",
} as const;
