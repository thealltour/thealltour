const BLOCKED_NEXT_PATHS = ["/login", "/signup", "/auth/link-account"];

export function sanitizeNextPath(raw: string | null | undefined, fallback = "/"): string {
  const value = raw?.trim() ?? "";
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (BLOCKED_NEXT_PATHS.some((p) => value === p || value.startsWith(`${p}?`))) {
    return fallback;
  }
  return value;
}

export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;
  return "http://localhost:3000";
}

/**
 * 카카오 디벨로퍼스는 Redirect URI를 단 1개만 등록할 수 있고(현재 apex: thealltour.com,
 * www 미등록), NEXT_PUBLIC_APP_URL이 www로 잘못 설정되면 카카오 동의 완료 시점에
 * redirect_uri 불일치로 콜백 자체가 호출되지 않아(가입 성공/실패 이벤트 모두 0건)
 * 전환이 조용히 실패한다. NEXT_PUBLIC_SITE_URL(캐노니컬 apex 도메인, SEO 등에서 이미
 * 검증됨)을 우선 사용해 이 불일치를 원천 차단한다.
 */
export function getOAuthRedirectUri(provider: string): string {
  if (provider === "kakao") {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (siteUrl) return `${siteUrl.replace(/\/$/, "")}/api/auth/${provider}/callback`;
  }
  return `${getAppBaseUrl()}/api/auth/${provider}/callback`;
}
