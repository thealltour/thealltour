/** 카카오싱크·비즈보드 하드코딩 랜딩 공통 상수 */

export const KAKAO_SYNC_GOLF_LANDING_SLUG = "kakao-sync";
export const KAKAO_SYNC_GOLF_TEMPLATE_TYPE = "kakao_sync_golf";
export const KAKAO_SYNC_GOLF_PUBLIC_PATH = "/golf/kakao-sync";

export function resolveKakaoSyncSiteOrigin(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://thealltour.com";
  return raw.replace(/\/$/, "");
}

/** 비즈보드용 공개 URL (utm_source=kakao, utm_medium=bizboard) */
export function buildKakaoSyncGolfPublicUrl(withUtm = true): string {
  const origin = resolveKakaoSyncSiteOrigin();
  if (!withUtm) return `${origin}${KAKAO_SYNC_GOLF_PUBLIC_PATH}`;
  const params = new URLSearchParams({
    utm_source: "kakao",
    utm_medium: "bizboard",
    utm_campaign: KAKAO_SYNC_GOLF_LANDING_SLUG,
  });
  return `${origin}${KAKAO_SYNC_GOLF_PUBLIC_PATH}?${params.toString()}`;
}
