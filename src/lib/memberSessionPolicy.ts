export function getMemberSessionCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: maxAgeSec,
  };
}
export const MEMBER_SESSION_REMEMBER_DAYS = envInt("MEMBER_SESSION_REMEMBER_DAYS", 90);

/** 체크 해제 시 쿠키 유지 기간 (일) — 브라우저 재실행 후 짧게 만료 */
export const MEMBER_SESSION_DEFAULT_DAYS = envInt("MEMBER_SESSION_DEFAULT_DAYS", 1);

export const MEMBER_SESSION_REMEMBER_MAX_AGE_SEC = MEMBER_SESSION_REMEMBER_DAYS * 24 * 60 * 60;
export const MEMBER_SESSION_DEFAULT_MAX_AGE_SEC = MEMBER_SESSION_DEFAULT_DAYS * 24 * 60 * 60;

function envInt(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return defaultValue;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : defaultValue;
}

export function resolveMemberSessionMaxAgeSec(rememberMe?: boolean): number {
  return rememberMe !== false
    ? MEMBER_SESSION_REMEMBER_MAX_AGE_SEC
    : MEMBER_SESSION_DEFAULT_MAX_AGE_SEC;
}

/**「로그인 상태 유지」체크 시 쿠키 유지 기간 (일) */
