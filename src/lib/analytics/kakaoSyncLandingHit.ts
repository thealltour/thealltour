/**
 * 카카오싱크·모바일 골프 광고 랜딩 경로 판별 (Edge/Node 공용, DB 없음).
 */

import {
  KAKAO_SYNC_GOLF_LANDING_SLUG,
  KAKAO_SYNC_GOLF_PUBLIC_PATH,
  KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
} from "@/lib/hardcodedLandings/kakaoSyncGolf/urls";

/** Middleware가 심는 쿠키 — 클라이언트 view 중복 방지 */
export const KAKAO_SYNC_LANDING_VIEW_COOKIE = "theall_ks_lv";

export type KakaoSyncLandingHitTarget = {
  sourcePath: string;
  landingSlug: string;
  templateType: string;
};

export function resolveKakaoSyncLandingHitTarget(
  pathname: string,
): KakaoSyncLandingHitTarget | null {
  const path = pathname.split("?")[0] ?? pathname;
  if (path === KAKAO_SYNC_GOLF_PUBLIC_PATH || path.startsWith(`${KAKAO_SYNC_GOLF_PUBLIC_PATH}/`)) {
    return {
      sourcePath: KAKAO_SYNC_GOLF_PUBLIC_PATH,
      landingSlug: KAKAO_SYNC_GOLF_LANDING_SLUG,
      templateType: KAKAO_SYNC_GOLF_TEMPLATE_TYPE,
    };
  }
  const adsMatch = path.match(/^\/golf\/ads\/([^/]+)\/?$/);
  if (adsMatch?.[1]) {
    const slug = decodeURIComponent(adsMatch[1]).trim();
    if (!slug) return null;
    return {
      sourcePath: `/golf/ads/${slug}`,
      landingSlug: slug,
      templateType: "mobile_golf_ad",
    };
  }
  return null;
}

export function isKakaoSyncFunnelAcquisition(acquisition: {
  landing_slug?: string | null;
  landing_path?: string | null;
} | null): boolean {
  if (!acquisition) return false;
  const slug = String(acquisition.landing_slug ?? "").trim();
  const path = String(acquisition.landing_path ?? "").trim();
  if (slug === KAKAO_SYNC_GOLF_LANDING_SLUG) return true;
  if (path.startsWith(KAKAO_SYNC_GOLF_PUBLIC_PATH) || path.startsWith("/golf/ads/")) return true;
  return false;
}

export function shouldSkipLandingHitRequest(request: {
  method: string;
  headers: { get(name: string): string | null };
}): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") return true;

  const purpose =
    request.headers.get("purpose") ||
    request.headers.get("Sec-Purpose") ||
    request.headers.get("x-middleware-prefetch");
  if (purpose === "prefetch" || purpose === "1") return true;

  const dest = request.headers.get("sec-fetch-dest");
  if (dest && dest !== "document" && dest !== "iframe" && dest !== "empty") {
    // empty: 일부 인앱 브라우저; document/iframe만 허용하되 empty는 통과
    if (dest === "image" || dest === "script" || dest === "style" || dest === "font") return true;
  }

  return false;
}
