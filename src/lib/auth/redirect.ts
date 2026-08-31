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
  return "http://localhost:4000";
}

/**
 * 카카오 디벨로퍼스 콘솔에 등록 가능한 Redirect URI는 단 1개뿐이며 현재
 * apex(thealltour.com, www 미등록)로 고정되어 있다. 반면 NEXT_PUBLIC_APP_URL은
 * 운영에서 www.thealltour.com으로 설정돼 있어(실측 확인됨), 이 값을 그대로 쓰면
 * 카카오가 동의 완료 시점에 redirect_uri 불일치로 콜백을 아예 호출하지 않고
 * 조용히 실패한다(가입 성공/실패 이벤트·회원 생성 모두 0건으로 관측됨).
 * NEXT_PUBLIC_APP_URL/NEXT_PUBLIC_SITE_URL 등 환경변수 설정 실수에 영향받지
 * 않도록, 카카오 콜백만은 등록된 apex 값을 코드에 고정한다.
 */
const KAKAO_OAUTH_APEX_BASE_URL = "https://thealltour.com";

export function getOAuthRedirectUri(provider: string): string {
  if (provider === "kakao") {
    return `${KAKAO_OAUTH_APEX_BASE_URL}/api/auth/${provider}/callback`;
  }
  return `${getAppBaseUrl()}/api/auth/${provider}/callback`;
}
