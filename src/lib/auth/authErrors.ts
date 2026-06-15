export const AUTH_ERROR_CODES = {
  oauth_cancelled: "oauth_cancelled",
  oauth_invalid_state: "oauth_invalid_state",
  oauth_unavailable: "oauth_unavailable",
  oauth_failed: "oauth_failed",
  oauth_already_linked: "oauth_already_linked",
} as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export const AUTH_ERROR_MESSAGES: Record<AuthErrorCode, string> = {
  oauth_cancelled: "소셜 로그인이 취소되었습니다.",
  oauth_invalid_state: "로그인 요청이 만료되었거나 올바르지 않습니다. 다시 시도해 주세요.",
  oauth_unavailable: "해당 소셜 로그인은 현재 사용할 수 없습니다.",
  oauth_failed: "소셜 로그인 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.",
  oauth_already_linked: "이 소셜 계정은 이미 다른 회원에 연결되어 있습니다.",
};

export function getAuthErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null;
  if (code in AUTH_ERROR_MESSAGES) {
    return AUTH_ERROR_MESSAGES[code as AuthErrorCode];
  }
  return null;
}

export function loginErrorRedirect(code: AuthErrorCode, next?: string): string {
  const params = new URLSearchParams({ error: code });
  if (next) params.set("next", next);
  return `/login?${params.toString()}`;
}
