/**
 * 헤더/검색/CTA 계측용 이벤트명·소스 상수.
 * 이후 PR에서 공통으로 사용할 이름을 고정한다.
 */

import type { AnalyticsEventName, AnalyticsSource } from "./types";

/** 이벤트명 상수 */
export const ANALYTICS_EVENTS: Record<AnalyticsEventName, AnalyticsEventName> = {
  header_nav_click: "header_nav_click",
  mega_menu_open: "mega_menu_open",
  mega_menu_click: "mega_menu_click",
  mobile_menu_open: "mobile_menu_open",
  mobile_menu_expand: "mobile_menu_expand",
  mobile_menu_click: "mobile_menu_click",
  search_submit: "search_submit",
  search_suggestion_click: "search_suggestion_click",
  search_recent_click: "search_recent_click",
  search_recommended_click: "search_recommended_click",
  search_result_click: "search_result_click",
  search_no_result: "search_no_result",
  search_filter_change: "search_filter_change",
  search_sort_change: "search_sort_change",
  search_relevance_sort: "search_relevance_sort",
  search_pagination_click: "search_pagination_click",
  search_recommendation_impression: "search_recommendation_impression",
  search_recommendation_click: "search_recommendation_click",
  search_load_more_click: "search_load_more_click",
  hero_search: "hero_search",
  hero_search_submit: "hero_search_submit",
  hero_autosuggest_impression: "hero_autosuggest_impression",
  hero_autosuggest_click: "hero_autosuggest_click",
  cta_click: "cta_click",
  landing_view: "landing_view",
  landing_product_click: "landing_product_click",
  product_card_click: "product_card_click",
  product_detail_cta_click: "product_detail_cta_click",
  product_detail_view_summary: "product_detail_view_summary",
  product_itinerary_day_click: "product_itinerary_day_click",
  product_itinerary_image_open: "product_itinerary_image_open",
  product_itinerary_cta_click: "product_itinerary_cta_click",
  product_cta_click: "product_cta_click",
} as const;

/** 소스 상수 (enum 성격) */
export const ANALYTICS_SOURCES: Record<AnalyticsSource, AnalyticsSource> = {
  header_desktop_primary: "header_desktop_primary",
  header_desktop_panel: "header_desktop_panel",
  header_mobile_drawer: "header_mobile_drawer",
  header_mobile_accordion: "header_mobile_accordion",
  header_search_desktop: "header_search_desktop",
  header_search_mobile: "header_search_mobile",
  home_curated_section: "home_curated_section",
  home_curated_catalog_cta: "home_curated_catalog_cta",
  products_catalog: "products_catalog",
  landing_region: "landing_region",
  landing_theme: "landing_theme",
  consult_cta: "consult_cta",
  hero_search: "hero_search",
} as const;
