/**
 * 사이트 공통 SEO 베이스 URL·절대 URL 유틸.
 * metadataBase, OG 이미지 fetch, canonical 등에서 공통 사용.
 */

export function getSiteBaseUrl(): string {
  const fallback = "https://thealltour.com";
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return fallback;

  try {
    const parsed = new URL(raw);
    const normalized = `${parsed.protocol}//${parsed.host}`;
    // production 빌드/런타임에서는 개발 도메인 유출 방지
    if (process.env.NODE_ENV === "production" && /localhost|127\.0\.0\.1/i.test(parsed.hostname)) {
      return fallback;
    }
    return normalized.replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export function toAbsoluteUrl(siteUrl: string, pathOrUrl: string): string {
  if (!pathOrUrl) return siteUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${siteUrl}${normalizedPath}`;
}
