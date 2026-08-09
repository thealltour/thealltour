/**
 * 카카오 OAuth 실패 원인 집계 (server-only 없음 — 단위 테스트용).
 */

export type KakaoOAuthFailureBreakdownRow = {
  /** reason 또는 oauthError 기준 키 */
  key: string;
  reason: string;
  oauthError: string | null;
  count: number;
};

export type KakaoOAuthFailureRecentRow = {
  occurredAt: string;
  reason: string;
  oauthError: string | null;
  oauthErrorDescription: string | null;
  message: string | null;
  landingSlug: string | null;
  sourcePath: string | null;
};

export type KakaoOAuthFailureEventLike = {
  event_name?: string | null;
  landing_slug?: string | null;
  source_path?: string | null;
  metadata?: unknown;
  occurred_at?: string | null;
};

function readMeta(metadata: unknown): Record<string, unknown> | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

function metaString(meta: Record<string, unknown> | null, key: string): string | null {
  if (!meta) return null;
  const v = meta[key];
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}

/** breakdown 키: oauthError가 있으면 그걸 우선(동의 취소·KOE 코드 구분), 없으면 reason */
export function kakaoOAuthFailureBreakdownKey(reason: string, oauthError: string | null): string {
  if (oauthError) return `${reason}:${oauthError}`;
  return reason;
}

export function aggregateKakaoOAuthFailures(
  rows: KakaoOAuthFailureEventLike[],
  options?: { recentLimit?: number },
): {
  breakdown: KakaoOAuthFailureBreakdownRow[];
  recent: KakaoOAuthFailureRecentRow[];
} {
  const recentLimit = options?.recentLimit ?? 30;
  const countMap = new Map<string, KakaoOAuthFailureBreakdownRow>();
  const recent: KakaoOAuthFailureRecentRow[] = [];

  for (const row of rows) {
    if (String(row.event_name ?? "") !== "kakao_oauth_failed") continue;
    const meta = readMeta(row.metadata);
    const reason = metaString(meta, "reason") ?? "unknown";
    const oauthError = metaString(meta, "oauthError");
    const oauthErrorDescription = metaString(meta, "oauthErrorDescription");
    const message = metaString(meta, "message");
    const key = kakaoOAuthFailureBreakdownKey(reason, oauthError);

    const existing = countMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      countMap.set(key, { key, reason, oauthError, count: 1 });
    }

    if (recent.length < recentLimit) {
      recent.push({
        occurredAt: String(row.occurred_at ?? ""),
        reason,
        oauthError,
        oauthErrorDescription,
        message,
        landingSlug: row.landing_slug?.trim() || null,
        sourcePath: row.source_path?.trim() || null,
      });
    }
  }

  const breakdown = [...countMap.values()].sort(
    (a, b) => b.count - a.count || a.key.localeCompare(b.key),
  );

  return { breakdown, recent };
}
