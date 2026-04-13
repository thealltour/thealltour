/** 상위 랜딩 각 축별 노출 개수 */
export const LANDING_ANALYTICS_TOP_PERFORMERS_LIMIT = 5;

/**
 * CTR 상위 후보 최소 모수: 조회 수 또는 클릭 수 중 하나라도 충족하면 포함
 * (표본이 너무 작을 때 100% CTR 노출 방지)
 */
export const LANDING_ANALYTICS_MIN_VIEWS_FOR_CTR_TOP = 5;
export const LANDING_ANALYTICS_MIN_CLICKS_FOR_CTR_TOP = 2;

/** CVR 상위 후보: 클릭이 충분할 때만 (submit/click 비율 신뢰) */
export const LANDING_ANALYTICS_MIN_CLICKS_FOR_CVR_TOP = 3;
