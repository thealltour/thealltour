/**
 * PR22: 리뷰 SEO용 본문/작성자/날짜 정제.
 * XSS·과도한 길이·개인정보 노출 방지.
 */

const MAX_REVIEW_BODY_LENGTH = 2000;

/**
 * reviewBody용 본문 정제.
 * trim, 연속 공백 정리, HTML 제거, 과도한 길이 truncate.
 */
export function sanitizeReviewBody(content: string | undefined): string | null {
  if (content == null || typeof content !== "string") return null;
  let s = content
    .trim()
    .replace(/\s+/g, " ")
    .replace(/<[^>]*>/g, "")
    .trim();
  if (s.length === 0) return null;
  if (s.length > MAX_REVIEW_BODY_LENGTH) {
    s = s.slice(0, MAX_REVIEW_BODY_LENGTH - 1).trim() + "…";
  }
  return s;
}

/**
 * schema author name: 실명/이메일 노출 방지, 안전한 공개명만.
 * 없으면 "익명".
 */
export function normalizeAuthorName(name: string | undefined): string {
  if (name == null || typeof name !== "string") return "익명";
  const t = name.trim();
  if (t.length === 0) return "익명";
  if (/@/.test(t)) return "익명";
  if (t.length > 50) return t.slice(0, 50).trim() + "…";
  return t;
}

/**
 * created_at → schema datePublished용 ISO date (YYYY-MM-DD).
 */
export function toIsoDate(createdAt: string | undefined): string | undefined {
  if (createdAt == null || typeof createdAt !== "string") return undefined;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

/**
 * JSON-LD 객체에서 undefined 제거, null 값 선택적 제거.
 */
export function compactJsonLd<T extends Record<string, unknown>>(
  value: T,
  options?: { removeNull?: boolean },
): T {
  const removeNull = options?.removeNull ?? true;
  const out = { ...value } as Record<string, unknown>;
  for (const key of Object.keys(out)) {
    const v = out[key];
    if (v === undefined) {
      delete out[key];
    } else if (removeNull && v === null) {
      delete out[key];
    } else if (v !== null && typeof v === "object" && !Array.isArray(v) && !(v instanceof Date)) {
      (out as Record<string, unknown>)[key] = compactJsonLd(v as Record<string, unknown>, options);
    }
  }
  return out as T;
}
