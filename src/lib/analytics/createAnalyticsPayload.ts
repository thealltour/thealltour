/**
 * 랜딩→quote funnel용 source_path 정규화 및 payload 보조.
 * 기본 createAnalyticsPayload는 ./payload 에서 re-export.
 */

export { createAnalyticsPayload, inferDeviceType, normalizeAnalyticsHref, normalizeAnalyticsLabel } from "./payload";

function decodeRecommendedSlugSegment(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** pathname에서 /recommended/[slug] 만 인식 */
function matchRecommendedSlugFromPathname(pathname: string): string | null {
  const m = pathname.trim().match(/^\/recommended\/([^/?#]+)/i);
  if (!m?.[1]) return null;
  return decodeRecommendedSlugSegment(m[1]);
}

/**
 * source_path(상대 경로 또는 전체 URL)에서 /recommended/[slug]의 slug 추출.
 * 절대 URL은 pathname만 파싱한다.
 */
export function landingSlugFromSourcePath(sourcePath: string | null | undefined): string | null {
  const s = typeof sourcePath === "string" ? sourcePath.trim() : "";
  if (!s) return null;

  if (s.startsWith("/")) {
    const hit = matchRecommendedSlugFromPathname(s);
    if (hit) return hit;
  }

  if (/^https?:\/\//i.test(s)) {
    try {
      const hit = matchRecommendedSlugFromPathname(new URL(s).pathname);
      if (hit) return hit;
    } catch {
      /* noop */
    }
    return null;
  }

  return null;
}

/**
 * source_path 필수 정책: 명시값 우선, 없으면 slug로 canonical 경로 생성.
 */
export function ensureLandingSourcePath(sourcePath: string | null | undefined, landingSlug: string): string {
  const explicit = typeof sourcePath === "string" ? sourcePath.trim() : "";
  if (explicit) return explicit;
  const slug = landingSlug.trim();
  return slug ? `/recommended/${encodeURIComponent(slug)}` : "/recommended";
}
