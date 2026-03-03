/**
 * 리워드(경품 교환) 정책 설정
 *
 * 최소 동작은 환경변수(env)로 시작. 추후 site_settings 또는 관리자 UI에서 덮어쓸 수 있도록 설계.
 *
 * 환경변수 (선택, 미설정 시 기본값 사용):
 * - REDEEM_MIN_POINTS: 최소 교환 포인트 (1회 교환에 필요한 최소 포인트) 기본 10000
 * - REDEEM_MONTHLY_LIMIT: 월 교환 횟수 제한 (회원당) 기본 1
 * - POINT_EXPIRY_MONTHS: 포인트 유효기간(월), ledger.expires_at 설정용 기본 12
 * - REDEEM_RATE_LIMIT_WINDOW_MINUTES: 동일 계정 반복 신청 rate limit 윈도우(분) 0이면 비활성 기본 60
 * - REDEEM_RATE_LIMIT_MAX_REQUESTS: 위 윈도우 내 허용 최대 신청 횟수 기본 3
 * - REDEEM_REJECT_LOOKBACK_DAYS: 반려/취소 카운트 기준 과거 일수 기본 90
 * - REDEEM_REJECT_THRESHOLD: 위 기간 내 반려+취소 누적 시 수동 검토(신청 차단) 기준 기본 3
 */

export type RewardPolicyConfig = {
  /** 최소 교환 포인트 (이 금액 미만 경품은 교환 불가 또는 교환 시 이 값 이상이어야 함) */
  minRedeemPoint: number;
  /** 월 교환 횟수 제한 (회원당, REQUESTED/APPROVED/SHIPPED/COMPLETED 합산) */
  monthlyRedeemLimit: number;
  /** 포인트 유효기간(월). EARN 생성 시 expires_at = now + 이 값 */
  pointExpiryMonths: number;
  /** 동일 계정 rate limit 윈도우(분). 0이면 비활성 */
  rateLimitWindowMinutes: number;
  /** 윈도우 내 최대 신청 횟수 */
  rateLimitMaxRequests: number;
  /** 반려/취소 누적 기간(일) */
  rejectLookbackDays: number;
  /** 위 기간 내 반려+취소 횟수 >= 이 값이면 신청 차단(수동 검토) */
  rejectThreshold: number;
};

const DEFAULT_MIN_REDEEM_POINT = 10_000;
const DEFAULT_MONTHLY_LIMIT = 1;
const DEFAULT_POINT_EXPIRY_MONTHS = 12;
const DEFAULT_RATE_LIMIT_WINDOW = 60;
const DEFAULT_RATE_LIMIT_MAX = 3;
const DEFAULT_REJECT_LOOKBACK_DAYS = 90;
const DEFAULT_REJECT_THRESHOLD = 3;

function envInt(key: string, defaultValue: number): number {
  const v = process.env[key];
  if (v === undefined || v === "") return defaultValue;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : defaultValue;
}

/**
 * 환경변수 기반 정책 로드.
 * 추후 getRewardPolicyFromSettings() 등을 만들어 site_settings 우선으로 합칠 수 있음.
 */
export function getRewardPolicy(): RewardPolicyConfig {
  return {
    minRedeemPoint: envInt("REDEEM_MIN_POINTS", DEFAULT_MIN_REDEEM_POINT),
    monthlyRedeemLimit: envInt("REDEEM_MONTHLY_LIMIT", DEFAULT_MONTHLY_LIMIT),
    pointExpiryMonths: envInt("POINT_EXPIRY_MONTHS", DEFAULT_POINT_EXPIRY_MONTHS),
    rateLimitWindowMinutes: envInt("REDEEM_RATE_LIMIT_WINDOW_MINUTES", DEFAULT_RATE_LIMIT_WINDOW),
    rateLimitMaxRequests: envInt("REDEEM_RATE_LIMIT_MAX_REQUESTS", DEFAULT_RATE_LIMIT_MAX),
    rejectLookbackDays: envInt("REDEEM_REJECT_LOOKBACK_DAYS", DEFAULT_REJECT_LOOKBACK_DAYS),
    rejectThreshold: envInt("REDEEM_REJECT_THRESHOLD", DEFAULT_REJECT_THRESHOLD),
  };
}

/** EARN 생성 시 사용할 expires_at (현재 시각 + pointExpiryMonths 개월). null이면 무제한. */
export function getPointExpiresAt(): string | null {
  const policy = getRewardPolicy();
  if (policy.pointExpiryMonths <= 0) return null;
  const d = new Date();
  d.setMonth(d.getMonth() + policy.pointExpiryMonths);
  return d.toISOString();
}
