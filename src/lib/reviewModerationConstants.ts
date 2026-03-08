/**
 * PR24: 리뷰 신고/자동 moderation 임계치 상수.
 */

/** 신고 N건 이상 시 자동 flagged */
export const REVIEW_REPORT_FLAG_THRESHOLD = 3;
/** 신고 N건 이상 시 under_review 권장 */
export const REVIEW_REPORT_UNDER_REVIEW_THRESHOLD = 2;
/** 신고 N건 이상 시 hidden 권장 */
export const REVIEW_REPORT_HIDE_THRESHOLD = 5;

/** Trust score 이 값 미만이면 high risk */
export const REVIEW_HIGH_RISK_TRUST_SCORE_THRESHOLD = 20;
/** Trust score 이 값 미만이면 low trust 패널티 */
export const REVIEW_LOW_TRUST_SCORE_THRESHOLD = 40;

/** Anomaly riskScore 이 값 이상이면 suspicious */
export const REVIEW_SUSPICIOUS_RISK_THRESHOLD = 5;
