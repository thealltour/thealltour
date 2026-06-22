/** DB inactivity 기준 자동 로그아웃 (일) */
export const ADMIN_SESSION_INACTIVITY_DAYS = envInt("ADMIN_SESSION_INACTIVITY_DAYS", 7);

/** httpOnly 쿠키 max-age 상한 (초) — 실질 만료는 DB last_seen_at */
export const ADMIN_SESSION_COOKIE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

/** JWT 서명 만료 상한 (초) — DB 세션 검증이 실질 게이트 */
export const ADMIN_SESSION_JWT_MAX_AGE_SEC = 90 * 24 * 60 * 60;

/** last_seen_at 갱신 최소 간격 (ms) */
export const ADMIN_SESSION_TOUCH_THROTTLE_MS = 10 * 60 * 1000;

/** @deprecated ADMIN_SESSION_COOKIE_MAX_AGE_SEC 사용 */
export const ADMIN_SESSION_MAX_AGE_SEC = ADMIN_SESSION_COOKIE_MAX_AGE_SEC;

function envInt(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return defaultValue;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

export function getAdminSessionInactivityMs(): number {
  return ADMIN_SESSION_INACTIVITY_DAYS * 24 * 60 * 60 * 1000;
}
