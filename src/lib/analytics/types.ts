/**
 * 헤더/검색/CTA 계측용 analytics 공통 payload 타입.
 * 저장·전송 연결은 하지 않으며, 타입/상수 정의만 사용.
 */

/** 이벤트명 — 헤더·메가메뉴·검색·CTA·상품 카드 클릭 계측 */
export type AnalyticsEventName =
  | "header_nav_click"
  | "mega_menu_open"
  | "mega_menu_click"
  | "mobile_menu_open"
  | "mobile_menu_expand"
  | "mobile_menu_click"
  | "search_submit"
  | "search_suggestion_click"
  | "search_recent_click"
  | "search_recommended_click"
  | "search_result_click"
  | "search_no_result"
  | "cta_click"
  | "landing_view"
  | "landing_product_click"
  | "product_card_click";

/** 발생 소스 구분용 상수 성격 */
export type AnalyticsSource =
  | "header_desktop_primary"
  | "header_desktop_panel"
  | "header_mobile_drawer"
  | "header_mobile_accordion"
  | "header_search_desktop"
  | "header_search_mobile"
  | "home_curated_section"
  | "home_curated_catalog_cta"
  | "products_catalog"
  | "landing_region"
  | "landing_theme"
  | "consult_cta";

/** 공통 payload — 모든 필드 선택, 호출 측에서 필요한 것만 채움 */
export type AnalyticsPayload = {
  eventName: AnalyticsEventName;
  source: AnalyticsSource;
  pagePath: string | null;
  deviceType: "desktop" | "mobile" | "unknown";
  taxonomyType: "category" | "theme" | null;
  taxonomyId: string | null;
  taxonomySlug: string | null;
  taxonomyName: string | null;
  section: string | null;
  label: string | null;
  href: string | null;
  position: number | null;
  query: string | null;
  resultCount: number | null;
  productId: string | null;
  occurredAt: string;
};
