/**
 * PR-IMAGE-4: 관리자 검수 보조 휴리스틱 (차단/자동 삭제 금지, badge·정렬·선택용).
 */

import { normalizeImageUrl } from "@/lib/images/normalizeImageUrl";

export type ImageHeuristicFlags = {
  isLikelyDuplicate: boolean;
  isLikelyThumbnail: boolean;
  isLikelyLogo: boolean;
  isLikelyLowPriority: boolean;
};

/** 익스텐션 dedupe와 유사: 모두투어 eagle 경로는 쿼리 제거, 그 외는 일부 쿼리 정리 */
export function normalizedDedupeKeyForAdmin(url: string): string {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed, "https://x");
    const host = u.hostname.toLowerCase();
    const path = u.pathname;
    if (host === "img.modetour.com" && path.includes("/eagle/photoimg/")) {
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

export function getImageHeuristicFlags(url: string): ImageHeuristicFlags {
  const lower = url.toLowerCase();
  return {
    isLikelyDuplicate: false,
    isLikelyThumbnail:
      lower.includes("thumb") ||
      lower.includes("thumbnail") ||
      /\bresize_w=\d+/i.test(lower) ||
      /\bresize_h=\d+/i.test(lower) ||
      /\b_w=\d+/i.test(lower) ||
      /\b_h=\d+/i.test(lower),
    isLikelyLogo:
      lower.includes("/logo/") ||
      lower.includes("/icon/") ||
      lower.includes("/air/logo/") ||
      lower.includes("favicon"),
    isLikelyLowPriority:
      lower.includes("banner") ||
      lower.includes("sprite") ||
      /\bicon\b/i.test(lower),
  };
}

export type UnassignedDuplicateMeta = {
  keyToUrls: Map<string, string[]>;
  urlToKey: Map<string, string>;
  urlToGroupSize: Map<string, number>;
  representativeUrlByKey: Map<string, string>;
};

export function buildUnassignedDuplicateMeta(urls: string[]): UnassignedDuplicateMeta {
  const keyToUrls = new Map<string, string[]>();
  const urlToKey = new Map<string, string>();
  for (const u of urls) {
    const key = normalizedDedupeKeyForAdmin(u);
    if (!key) continue;
    const list = keyToUrls.get(key) ?? [];
    list.push(u);
    keyToUrls.set(key, list);
    urlToKey.set(u, key);
  }
  const urlToGroupSize = new Map<string, number>();
  const representativeUrlByKey = new Map<string, string>();
  for (const [key, list] of keyToUrls) {
    representativeUrlByKey.set(key, list[0] ?? "");
    for (const u of list) {
      urlToGroupSize.set(u, list.length);
    }
  }
  return { keyToUrls, urlToKey, urlToGroupSize, representativeUrlByKey };
}

/** 대표 이미지 후보 점수 (높을수록 우선). 로고/썸네일 감점, 원본성 가점 */
export function scoreHeroCandidateUrl(url: string): number {
  const f = getImageHeuristicFlags(url);
  let score = 0;
  const lower = url.toLowerCase();
  if (lower.includes("/eagle/photoimg/")) score += 25;
  if (!f.isLikelyLogo) score += 20;
  else score -= 40;
  if (!f.isLikelyThumbnail) score += 18;
  else score -= 25;
  if (!f.isLikelyLowPriority) score += 6;
  else score -= 10;
  try {
    const u = new URL(url, "https://x");
    if (!u.search || u.search === "?") score += 5;
  } catch {
    /* ignore */
  }
  if (/\.(jpe?g|png|webp|avif)(\?|$)/i.test(lower)) score += 3;
  return score;
}

export function pickRecommendedHeroUrl(candidates: string[]): string | null {
  const filtered = candidates.map((u) => u?.trim()).filter(Boolean) as string[];
  if (filtered.length === 0) return null;
  const scored = [...filtered].sort((a, b) => scoreHeroCandidateUrl(b) - scoreHeroCandidateUrl(a));
  return scored[0] ?? null;
}

export function getAdminImageBadgeLabels(
  url: string,
  opts?: { duplicateGroupSize?: number; isDedupeRepresentative?: boolean },
): string[] {
  const labels: string[] = [];
  const f = getImageHeuristicFlags(url);
  if (f.isLikelyThumbnail) labels.push("thumb 의심");
  if (f.isLikelyLogo) labels.push("로고 의심");
  if (f.isLikelyLowPriority && !f.isLikelyLogo) labels.push("저해상도·아이콘 의심");
  const g = opts?.duplicateGroupSize ?? 0;
  if (g > 1) {
    labels.push(`중복 ${g}건`);
    if (opts?.isDedupeRepresentative) labels.push("대표 후보");
    else labels.push("파생 URL");
  }
  return labels;
}
