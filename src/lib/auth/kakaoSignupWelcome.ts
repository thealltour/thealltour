/** 카카오 신규 가입 웰컴 포인트 (원장 reason·알림 표기) */
export const KAKAO_SIGNUP_WELCOME_POINTS = 30_000;
export const KAKAO_SIGNUP_WELCOME_REASON = "카카오 30,000P";
export const KAKAO_SIGNUP_WELCOME_REF_TYPE = "KAKAO_SIGNUP_WELCOME";

export const KAKAO_WELCOME_QUERY_KEY = "welcome_kakao_points";
export const KAKAO_WELCOME_MYPAGE_PATH = `/mypage/dashboard?${KAKAO_WELCOME_QUERY_KEY}=1`;

/** OAuth 성공 후 토스트 노출용 next 경로 */
export function resolveKakaoWelcomeNextPath(originalNext: string): string {
  const trimmed = originalNext.trim() || "/mypage";
  if (trimmed === "/mypage" || trimmed.startsWith("/mypage?")) {
    return KAKAO_WELCOME_MYPAGE_PATH;
  }
  const [pathname, search = ""] = trimmed.split("?");
  const params = new URLSearchParams(search);
  params.set(KAKAO_WELCOME_QUERY_KEY, "1");
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
