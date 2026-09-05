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
  | "search_filter_change"
  | "search_sort_change"
  | "search_relevance_sort"
  | "search_pagination_click"
  | "search_recommendation_impression"
  | "search_recommendation_click"
  | "search_load_more_click"
  | "hero_search"
  | "hero_search_submit"
  | "hero_autosuggest_impression"
  | "hero_autosuggest_click"
  | "cta_click"
  | "landing_view"
  | "landing_section_view"
  | "landing_product_click"
  | "product_card_click"
  | "product_detail_cta_click"
  | "product_detail_view_summary"
  | "product_itinerary_day_click"
  | "product_itinerary_image_open"
  | "product_itinerary_cta_click"
  | "product_cta_click"
  | "quote_page_view"
  | "quote_view"
  | "quote_submit"
  | "quote_submit_click"
  | "quote_submit_success"
  | "landing_cta_click"
  | "consult_open"
  | "consult_submit"
  | "deposit_link_click"
  | "deposit_payment_click"
  | "kakao_oauth_start"
  | "kakao_oauth_success"
  | "kakao_signup_new"
  | "kakao_login_returning"
  | "kakao_oauth_failed"
  | "home_quick_action_click"
  | "home_section_more_click"
  | "home_promo_impression"
  | "home_promo_click"
  | "home_promo_dismiss"
  | "home_golf_schedule_click"
  | "auth_modal_open"
  | "auth_kakao_cta_click"
  | "auth_identifier_continue"
  | "auth_signup_success"
  | "auth_login_success"
  | "membership_benefit_cta_click"
  | "checkout_open"
  | "checkout_submit"
  | "checkout_payment_result"
  | "order_success_view"
  | "payment_return_view"
  | "payment_return_failed"
  | "planner_landing_view"
  | "planner_started"
  | "planner_input_completed";

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
  | "consult_cta"
  | "hero_search"
  | "quote_page"
  | "recommended_landing"
  | "deposit_page"
  | "kakao_sync_auth"
  | "home_hero"
  | "home_section"
  | "home_promo_banner"
  | "auth_modal"
  | "mypage_membership"
  | "payment_return"
  | "planner";

/** 공통 payload — 모든 필드 선택, 호출 측에서 필요한 것만 채움 */
export type AnalyticsPayload = {
  eventName: AnalyticsEventName;
  source: AnalyticsSource;
  pagePath: string | null;
  deviceType: "desktop" | "mobile" | "unknown";
  taxonomyType: "category" | "theme" | "destination" | "product_line" | null;
  taxonomyId: string | null;
  taxonomySlug: string | null;
  taxonomyName: string | null;
  /** 랜딩→quote funnel (DB 컬럼) */
  sourcePath: string | null;
  landingSlug: string | null;
  templateType: string | null;
  quoteCategory: string | null;
  section: string | null;
  label: string | null;
  href: string | null;
  position: number | null;
  query: string | null;
  resultCount: number | null;
  productId: string | null;
  occurredAt: string;
  /** 상세 CTA 등 추가 속성 (metadata jsonb에 저장) */
  metadata?: Record<string, unknown> | null;
};
