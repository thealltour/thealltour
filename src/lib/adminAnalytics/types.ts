/**
 * 관리자 analytics 읽기 전용 집계 레이어 타입.
 * 후속 PR에서 AdminDashboardKpiSectionWithProvider, /api/admin/dashboard, AdminProductTaxonomyView 연결 시 사용.
 */

/** 이벤트 source 구분용 (저장 레이어의 source 값과 일치) */
export type AnalyticsEventSource = string;

/** 요약 카운트 — 대시보드 KPI·차트용 */
export type AnalyticsSummaryCounts = {
  headerNavClicks: number;
  megaMenuClicks: number;
  searchSubmits: number;
  searchResultClicks: number;
  searchNoResultCount: number;
  ctaClicks: number;
  landingViews: number;
  landingProductClicks: number;
  /** 상품 카드 클릭 수 (홈/랜딩/목록 전체, product_card_click 이벤트) */
  productCardClicks: number;
};

/** Top N 아이템 — 헤더/메가메뉴/CTA 등 라벨·href 기준 집계 */
export type AnalyticsTopItem = {
  key: string;
  label: string;
  count: number;
  taxonomyType?: "region" | "theme" | "category" | null;
  taxonomySlug?: string | null;
  href?: string | null;
};

/** 검색 키워드별 통계 — 대시보드 Top 검색어·무결과 키워드용 */
export type AnalyticsSearchKeywordStat = {
  keyword: string;
  count: number;
  resultClickCount?: number;
  noResultCount?: number;
};

/** taxonomy(카테고리/테마)별 성과 — taxonomy 관리 탭 성과 컬럼용 */
export type AnalyticsTaxonomyMetric = {
  taxonomyType: "category" | "theme";
  taxonomyId?: string | null;
  taxonomyName: string;
  taxonomySlug?: string | null;
  headerClickCount: number;
  searchInboundCount: number;
  landingViewCount: number;
  landingProductClickCount: number;
  /** landingViewCount > 0 일 때만 계산, 아니면 null */
  landingCtr: number | null;
};

/** 대시보드용 analytics 개요 — KPI·Top 리스트·검색 키워드 통계 */
export type AdminAnalyticsOverview = {
  summary: AnalyticsSummaryCounts;
  topHeaderItems: AnalyticsTopItem[];
  topMegaMenuItems: AnalyticsTopItem[];
  topCtas: AnalyticsTopItem[];
  topSearchKeywords: AnalyticsSearchKeywordStat[];
  topNoResultKeywords: AnalyticsSearchKeywordStat[];
};

/** 집계 쿼리 공통 파라미터 — 날짜 범위 등 */
export type AdminAnalyticsQueryParams = {
  range?: string;
  from?: string;
  to?: string;
};
