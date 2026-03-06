/**
 * 이미지 수집 v3: hero(og:image 우선) + gallery/detail 강한 필터 + 일정 스코프 이미지.
 */

const EXCLUDE_EXT = /\.(svg|gif|ico)(\?|$)/i;
const EXCLUDE_KEYWORDS = /icon|logo|sprite|blank|loading|spinner|btn|banner|ad|kakao|naver|facebook|share|button|arrow|close|menu|pixel|1x1/i;
const EXCLUDE_SMALL_SIZE = /\bw=(?:16|24|32)\b/i;
const EXCLUDE_TRACKING = /analytics|doubleclick|google-analytics|tracking|pixel/i;
/** 항공사 코드 등 로고류 파일명: 2~3자 영문 + .png 등 */
const LOGO_LIKE_FILENAME = /\/([A-Z]{2}|[A-Z]{3})\.(png|jpe?g|webp)(\?|$)/i;
const MIN_DIMENSION = 80;
const GALLERY_MAX = 30;
const ITINERARY_IMAGES_PER_DAY_MAX = 5;

function getUrlFromImg(img: HTMLImageElement): string | null {
  const u =
    img.getAttribute("src") ||
    img.getAttribute("data-src") ||
    img.getAttribute("data-original");
  if (u?.trim()) return u.trim();
  const srcset = img.getAttribute("srcset");
  if (srcset?.trim()) {
    const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
    if (first) return first;
  }
  return null;
}

function shouldExcludeUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (EXCLUDE_EXT.test(lower)) return true;
  if (EXCLUDE_SMALL_SIZE.test(lower)) return true;
  if (EXCLUDE_TRACKING.test(lower)) return true;
  if (lower.includes("data:") && !lower.startsWith("data:http")) return true;
  if (/\/air\/logo\//i.test(url)) return true;
  if (!isEaglePhotoimg(url)) {
    if (LOGO_LIKE_FILENAME.test(url)) return true;
    if (EXCLUDE_KEYWORDS.test(lower)) return true;
  }
  try {
    const host = new URL(url, "https://x").hostname.toLowerCase();
    if (/analytics|doubleclick|google-analytics|tracking/.test(host)) return true;
  } catch {
    // ignore
  }
  return false;
}

/** eagle/photoimg 라인이면 로고/아이콘 필터를 통과시키기 위한 체크 */
function isEaglePhotoimg(url: string): boolean {
  try {
    const host = new URL(url, "https://x").hostname.toLowerCase();
    const path = new URL(url, "https://x").pathname.toLowerCase();
    return host === "img.modetour.com" && path.includes("/eagle/photoimg/");
  } catch {
    return false;
  }
}

/** 항공사 로고 등 hero 후보에서 제외할 URL인지 (img.modetour.com/air/logo/ 등) */
export function isAirlineLogoUrl(url: string): boolean {
  try {
    const u = new URL(url, "https://x");
    return u.hostname.toLowerCase() === "img.modetour.com" && /\/air\/logo\//i.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * URL에서 사이즈/캐시용 쿼리 제거 후 정규화 (중복 제거용).
 */
export function normalizeImageUrl(url: string): string {
  try {
    const u = new URL(url, "https://x");
    const drop = new Set(["w", "h", "width", "height", "cache", "v", "ver", "t", "timestamp"]);
    const search = new URLSearchParams();
    u.searchParams.forEach((v, k) => {
      const low = k.toLowerCase();
      if (!drop.has(low) && low !== "quality" && !/^_\d+$/.test(low)) search.set(k, v);
    });
    u.search = search.toString();
    return u.href;
  } catch {
    return url;
  }
}

/**
 * 모두투어 이미지 URL 정규화: resize 등 쿼리 제거, 원본 경로 반환.
 * img.modetour.com/eagle/photoimg/* => search 완전 제거.
 * 그 외 도메인 => utm, cache-bust, resize 류 파라미터 제거.
 */
export function normalizeModetourImageUrl(url: string): string {
  try {
    const u = new URL(url, "https://x");
    const path = u.pathname;
    const host = u.hostname.toLowerCase();
    const isEagle = host === "img.modetour.com" && path.includes("/eagle/photoimg/");
    if (isEagle || /\.(jpe?g|png|webp)(\?|$)/i.test(path)) {
      u.search = "";
      return u.href;
    }
    const dropParams = new Set([
      "resize", "resize_w", "resize_h", "w", "h", "width", "height",
      "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
      "cache", "v", "ver", "t", "timestamp", "quality",
    ]);
    u.searchParams.forEach((_, k) => {
      const low = k.toLowerCase();
      if (dropParams.has(low) || /^_\d+$/.test(low)) u.searchParams.delete(k);
    });
    return u.href;
  } catch {
    return url;
  }
}

/**
 * 중복 제거용 정규화 키: modetour eagle/photoimg는 쿼리 전부 제거, 그 외는 resize/utm 등 제거.
 */
export function normalizedKeyForDedupe(url: string): string {
  try {
    const u = new URL(url, "https://x");
    if (u.hostname.toLowerCase() === "img.modetour.com" && u.pathname.includes("/eagle/photoimg/")) {
      return normalizeModetourImageUrl(url);
    }
    return normalizeImageUrl(url);
  } catch {
    return url;
  }
}

export function normalizeAndDedupe(urls: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const key = normalizedKeyForDedupe(u);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}

function collectFromNode(root: Element): string[] {
  const out: string[] = [];
  root.querySelectorAll("img[src], img[data-src], img[data-original], img[srcset]").forEach((el) => {
    const img = el as HTMLImageElement;
    const url = getUrlFromImg(img);
    if (!url || shouldExcludeUrl(url)) return;
    const w = img.naturalWidth ?? img.width;
    const h = img.naturalHeight ?? img.height;
    if (typeof w === "number" && typeof h === "number" && (w < MIN_DIMENSION || h < MIN_DIMENSION)) return;
    out.push(url);
  });
  root.querySelectorAll("[style*='background-image']").forEach((el) => {
    const style = (el as HTMLElement).getAttribute("style") ?? "";
    const m = style.match(/url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/);
    if (!m?.[1]) return;
    const url = m[1].trim();
    if (!url || shouldExcludeUrl(url)) return;
    out.push(url);
  });
  root.querySelectorAll("source[srcset]").forEach((el) => {
    const srcset = el.getAttribute("srcset");
    if (!srcset?.trim()) return;
    const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
    if (first && !shouldExcludeUrl(first)) out.push(first);
  });
  return out;
}

const MIN_SIZE_DEFAULT = 80;

/**
 * 노드 내부 이미지 수집 시 요소 크기(getBoundingClientRect)로 필터.
 * width 또는 height가 minW/minH 미만이면 제외(아이콘/버튼 방지).
 */
export function extractImageUrlsFromNodeWithSizeFilter(
  container: Element,
  minW: number = MIN_SIZE_DEFAULT,
  minH: number = MIN_SIZE_DEFAULT,
): string[] {
  const out: string[] = [];
  container.querySelectorAll("img[src], img[data-src], img[data-original], img[srcset]").forEach((el) => {
    const img = el as HTMLImageElement;
    const url = getUrlFromImg(img);
    if (!url || shouldExcludeUrl(url)) return;
    const rect = img.getBoundingClientRect();
    if (rect.width < minW || rect.height < minH) return;
    const w = img.naturalWidth ?? img.width ?? rect.width;
    const h = img.naturalHeight ?? img.height ?? rect.height;
    if (typeof w === "number" && typeof h === "number" && (w < minW || h < minH)) return;
    out.push(url);
  });
  container.querySelectorAll("[style*='background-image']").forEach((el) => {
    const style = (el as HTMLElement).getAttribute("style") ?? "";
    const m = style.match(/url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/);
    if (!m?.[1]) return;
    const url = m[1].trim();
    if (!url || shouldExcludeUrl(url)) return;
    const rect = (el as HTMLElement).getBoundingClientRect();
    if (rect.width < minW || rect.height < minH) return;
    out.push(url);
  });
  container.querySelectorAll("source[srcset]").forEach((el) => {
    const srcset = el.getAttribute("srcset");
    if (!srcset?.trim()) return;
    const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
    if (first && !shouldExcludeUrl(first)) {
      const rect = (el as HTMLElement).getBoundingClientRect();
      if (rect.width >= minW && rect.height >= minH) out.push(first);
    }
  });
  return normalizeAndDedupe(out);
}

/**
 * 특정 노드(예: 일정 스코프 컨테이너) 내부에서만 이미지 URL 수집.
 */
export function extractImageUrlsFromNode(container: Element): string[] {
  const raw = collectFromNode(container);
  return normalizeAndDedupe(raw);
}

/**
 * URL 배열에 기존 필터(확장자/키워드/작은 크기/추적) 적용 후 정규화·중복 제거.
 * 이벤트/일정 등 노드 범위 추출 후 재사용용.
 */
export function filterUsefulImageUrls(urls: string[]): string[] {
  const filtered = urls.filter((u) => !shouldExcludeUrl(u));
  return normalizeAndDedupe(filtered);
}

/**
 * 페이지 전체에서 갤러리/상세용 이미지 URL 수집 (강한 필터 + 정규화·중복 제거).
 */
export function extractImageUrlsFromDom(): string[] {
  if (typeof document === "undefined") return [];
  const raw = collectFromNode(document.body);
  return normalizeAndDedupe(raw).slice(0, GALLERY_MAX);
}

/**
 * Hero 후보 순서: 1) og:image, 2) JSON-LD image[0], 3) 첫 Day 첫 activity 이벤트 첫 이미지, 4) gallery 등.
 * 항공사 로고(air/logo)는 제외.
 */
export function getHeroCandidates(jsonLdImage?: string, firstActivityImage?: string): string[] {
  const candidates: string[] = [];
  if (typeof document !== "undefined") {
    const og = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
    if (og?.trim()) candidates.push(og.trim());
  }
  if (jsonLdImage?.trim()) candidates.push(jsonLdImage.trim());
  if (firstActivityImage?.trim()) candidates.push(firstActivityImage.trim());
  if (typeof document !== "undefined") {
    const fromDom = collectFromNode(document.body);
    for (const u of fromDom) {
      if (!shouldExcludeUrl(u)) {
        candidates.push(u);
        break;
      }
    }
  }
  const deduped = normalizeAndDedupe(candidates);
  return deduped.filter((u) => !isAirlineLogoUrl(u));
}

/**
 * Hero 이미지 1개 선정: 후보 목록에서 첫 번째 유효 URL (필터 통과, 항공로고 제외).
 */
export function pickHeroImage(
  imageUrls: string[],
  jsonLdHero?: string,
  firstActivityFirstImage?: string,
): string | undefined {
  const candidates = getHeroCandidates(jsonLdHero, firstActivityFirstImage);
  for (const u of candidates) {
    if (!shouldExcludeUrl(u) && !isAirlineLogoUrl(u)) return normalizedKeyForDedupe(u);
  }
  if (imageUrls.length > 0) {
    const first = imageUrls.find((u) => !shouldExcludeUrl(u) && !isAirlineLogoUrl(u));
    if (first) return normalizedKeyForDedupe(first);
  }
  return undefined;
}

/**
 * 일정 일수에 맞춰 itineraryImageUrls를 day별로 나누어 각 day당 최대 N장 할당.
 */
export function assignItineraryImagesToDays(
  itineraryImageUrls: string[],
  dayCount: number,
  maxPerDay: number = ITINERARY_IMAGES_PER_DAY_MAX,
): string[][] {
  if (dayCount <= 0 || itineraryImageUrls.length === 0) return [];
  const perDay = Math.max(1, Math.floor(itineraryImageUrls.length / dayCount));
  const take = Math.min(perDay, maxPerDay);
  const result: string[][] = [];
  let idx = 0;
  for (let i = 0; i < dayCount && idx < itineraryImageUrls.length; i++) {
    const slice: string[] = [];
    for (let j = 0; j < take && idx < itineraryImageUrls.length; j++) {
      slice.push(itineraryImageUrls[idx++]);
    }
    result.push(slice);
  }
  return result;
}
