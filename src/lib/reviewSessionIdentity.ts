/**
 * PR27: attribution용 session/user 식별.
 * 로그인 없는 사용자도 sessionKey 우선으로 분석 가능.
 */

const SESSION_KEY_STORAGE = "review_attr_session";
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24h

export interface AttributionIdentity {
  sessionKey: string | null;
  userKey: string | null;
}

/**
 * 클라이언트에서 호출: localStorage 기반 session key 생성/유지.
 * SSR에서는 null 반환 가능.
 */
export function getAnalyticsSessionKey(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as { key: string; exp: number };
      if (parsed.exp > Date.now()) return parsed.key;
    }
    const key = `s_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    localStorage.setItem(
      SESSION_KEY_STORAGE,
      JSON.stringify({ key, exp: Date.now() + SESSION_TTL_MS }),
    );
    return key;
  } catch {
    return null;
  }
}

/**
 * 로그인 사용자 식별자. 현재는 미구현 시 null.
 */
export function getAnalyticsUserKey(): string | null {
  if (typeof window === "undefined") return null;
  // TODO: auth context에서 user id 연동
  return null;
}

/**
 * attribution 그룹핑용 키: session 우선, 없으면 user.
 */
export function getAttributionSubjectKey(identity: AttributionIdentity): string | null {
  return identity.sessionKey ?? identity.userKey ?? null;
}

/**
 * 현재 identity 수집 (클라이언트).
 */
export function getAttributionIdentity(): AttributionIdentity {
  return {
    sessionKey: getAnalyticsSessionKey(),
    userKey: getAnalyticsUserKey(),
  };
}
