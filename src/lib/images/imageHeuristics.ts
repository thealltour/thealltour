/**
 * PR-IMAGE-5: 등록 직전 자동 정리용 경량 휴리스틱 (차단 아님, 정리 후보만).
 */

import { normalizeImageUrl } from "./normalizeImageUrl";

/** 모두투어·CDN 파생 URL을 같은 이미지로 묶기 위한 키 (익스텐션 dedupe와 유사) */
export function normalizeImageDedupeKey(url: string): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed, "https://x");
    const host = u.hostname.toLowerCase();
    if (host === "img.modetour.com" && u.pathname.includes("/eagle/photoimg/")) {
      u.search = "";
      return u.href;
    }
    const drop = new Set(["w", "h", "width", "height", "cache", "v", "ver", "t", "timestamp"]);
    const next = new URL(u.href);
    const sp = new URLSearchParams();
    u.searchParams.forEach((val, k) => {
      const low = k.toLowerCase();
      if (!drop.has(low) && low !== "quality" && !/^_\d+$/.test(low)) sp.set(k, val);
    });
    next.search = sp.toString();
    return next.href;
  } catch {
    return normalizeImageUrl(trimmed);
  }
}

export function isLikelyLogo(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("logo") ||
    u.includes("/icon/") ||
    u.includes("/air/logo/") ||
    u.includes("favicon")
  );
}

export function isLikelyThumbnail(url: string): boolean {
  const u = url.toLowerCase();
  return (
    u.includes("thumb") ||
    u.includes("thumbnail") ||
    /\bresize_w=\d+/i.test(u) ||
    /\bresize_h=\d+/i.test(u)
  );
}

/** 대표 후보 점수 (높을수록 우선). 로고/썸네일 감점 */
export function scoreHeroCandidate(url: string): number {
  let s = 0;
  if (!isLikelyLogo(url)) s += 20;
  else s -= 50;
  if (!isLikelyThumbnail(url)) s += 18;
  else s -= 25;
  if (url.toLowerCase().includes("/eagle/photoimg/")) s += 12;
  try {
    const u = new URL(url, "https://x");
    if (!u.search || u.search === "?") s += 4;
  } catch {
    /* ignore */
  }
  if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(url)) s += 3;
  return s;
}
