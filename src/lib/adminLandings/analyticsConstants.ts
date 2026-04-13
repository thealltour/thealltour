/**
 * 랜딩 slug를 알 수 없는 퍼널 이벤트 집계용 버킷.
 * 실제 랜딩 slug와 충돌하지 않도록 예약된 값이다.
 */
export const LANDING_ANALYTICS_UNATTRIBUTED_SLUG = "__unattributed__";

/** 관리자 UI에 표시할 미식별 버킷 제목 */
export const LANDING_ANALYTICS_UNATTRIBUTED_TITLE = "미분류 (랜딩 미식별)";

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
