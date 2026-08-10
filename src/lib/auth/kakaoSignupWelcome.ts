/** 카카오 신규 가입 웰컴 포인트 (원장 reason·알림 표기) */
export const KAKAO_SIGNUP_WELCOME_POINTS = 50_000;
export const KAKAO_SIGNUP_WELCOME_REASON = "카카오 50,000P";
export const KAKAO_SIGNUP_WELCOME_REF_TYPE = "KAKAO_SIGNUP_WELCOME";

export const KAKAO_WELCOME_QUERY_KEY = "welcome_kakao_points";
export const KAKAO_WELCOME_MYPAGE_PATH = `/mypage/dashboard?${KAKAO_WELCOME_QUERY_KEY}=1`;
export const KAKAO_SYNC_POST_AUTH_DASHBOARD_PATH = "/mypage/dashboard";

/** OAuth 성공 후 토스트 노출용 next 경로 */
export function resolveKakaoWelcomeNextPath(originalNext: string): string {
  const trimmed = originalNext.trim() || "/mypage";
  if (
    trimmed === "/mypage" ||
    trimmed.startsWith("/mypage?") ||
    trimmed === "/mypage/dashboard" ||
    trimmed.startsWith("/mypage/dashboard?")
  ) {
    return KAKAO_WELCOME_MYPAGE_PATH;
  }
  const [pathname, search = ""] = trimmed.split("?");
  const params = new URLSearchParams(search);
  params.set(KAKAO_WELCOME_QUERY_KEY, "1");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}

/**
 * 카카오싱크 퍼널 OAuth 성공 후 목적지.
 * complete-profile을 거치지 않고 마이페이지 대시보드로 직행한다.
 */
export function resolveKakaoSyncPostAuthDestination(input: {
  next: string;
  welcomeGranted?: boolean;
}): string {
  if (input.welcomeGranted) {
    return resolveKakaoWelcomeNextPath(input.next || KAKAO_SYNC_POST_AUTH_DASHBOARD_PATH);
  }
  const trimmed = (input.next || "").trim();
  if (
    !trimmed ||
    trimmed === "/mypage" ||
    trimmed.startsWith("/mypage?") ||
    trimmed === "/mypage/dashboard" ||
    trimmed.startsWith("/mypage/dashboard?")
  ) {
    return KAKAO_SYNC_POST_AUTH_DASHBOARD_PATH;
  }
  return trimmed;
}
