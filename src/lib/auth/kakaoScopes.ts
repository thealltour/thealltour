/**
 * Kakao optional scopes for action-specific OAuth (on-demand consent).
 * Never inject arbitrary scope strings from the client.
 */

export const KAKAO_LOGIN_SCOPES = ["name", "phone_number", "plusfriends"] as const;

export const KAKAO_OPTIONAL_SCOPES = [
  "talk_message",
  "talk_calendar",
  "talk_calendar_task",
] as const;

export type KakaoLoginScope = (typeof KAKAO_LOGIN_SCOPES)[number];
export type KakaoOptionalScope = (typeof KAKAO_OPTIONAL_SCOPES)[number];

const OPTIONAL_SCOPE_SET = new Set<string>(KAKAO_OPTIONAL_SCOPES);

export function isKakaoOptionalScope(value: string): value is KakaoOptionalScope {
  return OPTIONAL_SCOPE_SET.has(value);
}

/**
 * Validates additional scopes against the allowlist.
 * Rejects unknown strings (no silent drop — callers must not pass untrusted input).
 */
export function sanitizeKakaoAdditionalScopes(
  additional?: readonly string[] | null,
): KakaoOptionalScope[] {
  if (!additional?.length) return [];
  const out: KakaoOptionalScope[] = [];
  for (const raw of additional) {
    const scope = String(raw ?? "").trim();
    if (!scope) continue;
    if (!isKakaoOptionalScope(scope)) {
      throw new Error(`kakao_scope_not_allowed:${scope}`);
    }
    if (!out.includes(scope)) out.push(scope);
  }
  return out;
}

/** Login scopes + validated optional scopes (deduped, stable order). */
export function resolveKakaoAuthorizationScopes(
  additional?: readonly string[] | null,
): string {
  const extras = sanitizeKakaoAdditionalScopes(additional);
  return [...KAKAO_LOGIN_SCOPES, ...extras].join(",");
}
