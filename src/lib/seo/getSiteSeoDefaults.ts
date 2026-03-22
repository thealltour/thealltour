/**
 * 사이트 공통 SEO 베이스 URL·절대 URL 유틸.
 * metadataBase, OG 이미지 fetch, canonical 등에서 공통 사용.
 */

export function getSiteBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://thealltour.com").replace(/\/$/, "");
}

export function toAbsoluteUrl(siteUrl: string, pathOrUrl: string): string {
  if (!pathOrUrl) return siteUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const normalizedPath = pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`;
  return `${siteUrl}${normalizedPath}`;
}
