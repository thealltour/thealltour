/**
 * 랜딩→quote funnel용 source_path 정규화 및 payload 보조.
 * 기본 createAnalyticsPayload는 ./payload 에서 re-export.
 */

export { createAnalyticsPayload, inferDeviceType, normalizeAnalyticsHref, normalizeAnalyticsLabel } from "./payload";

/** /recommended/[slug] 에서 slug 추출 */
export function landingSlugFromSourcePath(sourcePath: string | null | undefined): string | null {
  const s = typeof sourcePath === "string" ? sourcePath.trim() : "";
  if (!s) return null;
  const m = s.match(/^\/recommended\/([^/?#]+)/i);
  if (!m?.[1]) return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return m[1];
  }
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
