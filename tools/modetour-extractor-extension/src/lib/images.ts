/**
 * 이미지 수집: hero / itinerary / detail 우선 수집 + hard filter + dedupe + 우선순위 정렬.
 * 명백한 비상품만 제외; 썸네일은 제외하지 않고 저우선순위로만 정렬.
 * validateImageUrl 기반 로드 검증은 기본 추출 파이프라인에서는 사용하지 않음 (함수는 유지).
 */

import { getImageUrl, pickLargestUrlFromSrcset } from "~lib/selectors";
import type { ExtractMeta } from "~lib/extractTypes";

/** imageDebug 카운터 타입 (증분용) */
export type ImageDebugCounters = NonNullable<ExtractMeta["imageDebug"]>;

const MIN_DIMENSION = 80;
const GALLERY_MAX = 30;
const ITINERARY_IMAGES_PER_DAY_MAX = 5;

// ----- 강제 제외만 (명백한 비상품). 썸네일/일반문자열은 제외하지 않고 저우선순위로만 처리 -----
const DATA_URI = /^data:/i;
const SVG_EXT = /\.svg(\?|$)/i;
const GIF_EXT = /\.gif(\?|$)/i;
const ICO_EXT = /\.ico(\?|$)/i;
const TRACKING = /doubleclick\.net|google-analytics|tracking|pixel|\/_next\/static\/media\//i;
const AIR_LOGO = /\/air\/logo\//i;
/** 경로 세그먼트로만 매칭 (과탐 방지): /icon/, /logo/, /banner/, /sprite/ */
const PATH_STATIC_UI = /\/(icon|logo|banner|sprite)(\/|$)/i;
const POLICY_ICONS = /calendar_tick|airplane|shopping_bag|dollar_circle|task_square|element_plus|cancellation_fee_policy|payment_information|precaution|pixel/i;
/** 항공사 코드 등 로고류 파일명 */
const LOGO_LIKE_FILENAME = /\/([A-Z]{2}|[A-Z]{3})\.(png|jpe?g|webp)(\?|$)/i;

/** itinerary 전용 hard exclude: 썸네일/리사이즈는 제외하지 않음 */
const ITINERARY_EXCLUDE_DATA = /^data:/i;
const ITINERARY_EXCLUDE_EXT = /\.(svg|gif|ico)(\?|$)/i;
const ITINERARY_EXCLUDE_TRACKING = /doubleclick|pixel|tracking|\/_next\/static\/media\//i;
const ITINERARY_EXCLUDE_AIR_LOGO = /\/air\/logo\//i;
const ITINERARY_EXCLUDE_POLICY = /cancellation_fee_policy|payment_information|precaution/i;

/** 157x157 등 썸네일 리사이즈 — 제외하지 않고 우선순위만 낮춤 */
const THUMB_RESIZE = /resize_w=157|resize_h=157|resize_w=\d{2,3}[^0-9]|resize_h=\d{2,3}[^0-9]/i;
const THUMB_KEYWORDS = /thumb|small|_s\.|_m\.|thumbnail/i;

/**
 * 상대 URL을 base 기준 절대 URL로 변환.
 */
export function toAbsoluteImageUrl(url: string, base: string): string {
  const u = url?.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  try {
    return new URL(u, base).href;
  } catch {
    return u;
  }
}

/** eagle/photoimg 라인이면 상품 이미지로 허용 (로고/아이콘 필터 예외) */
function isEaglePhotoimg(url: string): boolean {
  try {
    const host = new URL(url, "https://x").hostname.toLowerCase();
    const path = new URL(url, "https://x").pathname.toLowerCase();
    return host === "img.modetour.com" && path.includes("/eagle/photoimg/");
  } catch {
    return false;
  }
}

/**
 * 썸네일성 URL 여부 (157x157 리사이즈, thumb/small 등).
 * 제외하지 않고 우선순위 점수만 낮춤.
 */
export function isLikelyThumbnailUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (THUMB_RESIZE.test(lower)) return true;
  if (THUMB_KEYWORDS.test(lower)) return true;
  return false;
}

/**
 * 명백한 비상품 이미지만 강제 제외. thumbnail/일반문자열은 여기서 제외하지 않음.
 */
export function isClearlyNonProductImage(url: string): boolean {
  const lower = url.toLowerCase();
  if (DATA_URI.test(url) && !lower.startsWith("data:http")) return true;
  if (SVG_EXT.test(lower)) return true;
  if (GIF_EXT.test(lower)) return true;
  if (ICO_EXT.test(lower)) return true;
  if (TRACKING.test(lower)) return true;
  if (AIR_LOGO.test(url)) return true;
  try {
    const parsed = new URL(url, "https://x");
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (/analytics|doubleclick|google-analytics|tracking/.test(host)) return true;
    if (PATH_STATIC_UI.test(path)) return true;
  } catch {
    // ignore
  }
  if (!isEaglePhotoimg(url)) {
    if (LOGO_LIKE_FILENAME.test(url)) return true;
    if (POLICY_ICONS.test(lower)) return true;
  }
  return false;
}

/**
 * 제외 사유 분류 (hard exclude만). 썸네일은 null 반환 → 제외하지 않고 저우선순위로 유지.
 */
export function getExclusionReason(url: string): keyof ImageDebugCounters | null {
  const lower = url.toLowerCase();
  if (DATA_URI.test(url) && !lower.startsWith("data:http")) return "excludedDataUri";
  if (SVG_EXT.test(lower)) return "excludedSvg";
  if (TRACKING.test(lower)) return "excludedTracking";
  try {
    if (PATH_STATIC_UI.test(new URL(url, "https://x").pathname)) return "excludedStaticUi";
  } catch {
    // ignore
  }
  if (LOGO_LIKE_FILENAME.test(url)) return "excludedStaticUi";
  if (POLICY_ICONS.test(lower)) return "excludedPolicy";
  if (AIR_LOGO.test(url)) return "excludedStaticUi";
  if (GIF_EXT.test(lower) || ICO_EXT.test(lower)) return "excludedSvg";
  return null;
}

const DEFAULT_VALIDATE_TIMEOUT_MS = 3000;

/**
 * 실제 로드 검증: new Image() 로 로드 후 naturalWidth/naturalHeight 확인.
 * timeoutMs 내 완료되지 않으면 TIMEOUT 으로 resolve. 절대 pending 에 남지 않음.
 */
export function validateImageUrl(
  url: string,
  minW: number = 200,
  minH: number = 120,
  timeoutMs: number = DEFAULT_VALIDATE_TIMEOUT_MS,
): Promise<{ ok: boolean; width: number; height: number; reason?: string }> {
  return new Promise((resolve) => {
    let settled = false;
    let tid: ReturnType<typeof setTimeout> | undefined;
    const img = new Image();
    const once = (result: { ok: boolean; width: number; height: number; reason?: string }) => {
      if (settled) return;
      settled = true;
      if (tid != null) clearTimeout(tid);
      img.onload = null;
      img.onerror = null;
      img.src = "";
      resolve(result);
    };

    const u = url?.trim();
    if (!u) {
      once({ ok: false, width: 0, height: 0, reason: "INVALID_URL" });
      return;
    }
    try {
      new URL(u, "https://x");
    } catch {
      once({ ok: false, width: 0, height: 0, reason: "INVALID_URL" });
      return;
    }

    tid = setTimeout(() => {
      once({ ok: false, width: 0, height: 0, reason: "TIMEOUT" });
    }, timeoutMs);

    img.onload = () => {
      const w = img.naturalWidth ?? 0;
      const h = img.naturalHeight ?? 0;
      if (w < minW || h < minH) {
        once({ ok: false, width: w, height: h, reason: "TOO_SMALL" });
      } else {
        once({ ok: true, width: w, height: h });
      }
    };
    img.onerror = () => {
      once({ ok: false, width: 0, height: 0, reason: "LOAD_ERROR" });
    };
    img.src = u;
  });
}

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

/** 우선순위 점수: hero/bfile/본문성 > 일반 상세 > 썸네일. 썸네일은 제외하지 않고 뒤로만 정렬 */
function imagePriorityScore(url: string): number {
  const lower = url.toLowerCase();
  let score = 50;
  if (/hero|bfile|eagle\/photoimg/.test(lower)) score += 30;
  if (/\.(jpg|jpeg|png|webp)(\?|$)/i.test(url) && !isLikelyThumbnailUrl(url)) score += 20;
  if (isLikelyThumbnailUrl(url)) score -= 25;
  return score;
}

function getBaseUrlFromNode(node: Element): string {
  const doc = node.ownerDocument;
  return (doc?.defaultView as Window | undefined)?.location?.href ?? "https://www.modetour.com/";
}

/**
 * 컨테이너 내부에서 첫 번째 유효 이미지 URL 1개 반환.
 * img[src/data-src/data-original/srcset], source[srcset], background-image 탐색, 명백한 비상품은 제외.
 */
export function getFirstImageUrlInContainer(container: Element, baseUrl: string): string | undefined {
  const candidates: string[] = [];
  container.querySelectorAll("img[src], img[data-src], img[data-original], img[srcset]").forEach((el) => {
    const url = getImageUrl(el as HTMLImageElement);
    if (url) candidates.push(toAbsoluteImageUrl(url, baseUrl));
  });
  container.querySelectorAll("[style*='background-image']").forEach((el) => {
    const style = (el as HTMLElement).getAttribute("style") ?? "";
    const m = style.match(/url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/);
    if (m?.[1]) candidates.push(toAbsoluteImageUrl(m[1].trim(), baseUrl));
  });
  container.querySelectorAll("source[srcset]").forEach((el) => {
    const srcset = el.getAttribute("srcset");
    if (srcset?.trim()) {
      const picked = pickLargestUrlFromSrcset(srcset, baseUrl);
      if (picked) candidates.push(toAbsoluteImageUrl(picked, baseUrl));
    }
  });
  for (const u of candidates) {
    if (!u || isClearlyNonProductImage(u)) continue;
    return u;
  }
  return undefined;
}

/**
 * 노드 내부에서 이미지 URL 수집.
 * img(src/data-src/data-original/srcset), source[srcset], scope 내 background-image 지원.
 */
function collectFromNode(root: Element, baseUrl: string): string[] {
  const out: string[] = [];
  root.querySelectorAll("img[src], img[data-src], img[data-original], img[srcset]").forEach((el) => {
    const img = el as HTMLImageElement;
    const url = getImageUrl(img);
    if (!url) return;
    const absolute = toAbsoluteImageUrl(url, baseUrl);
    if (!absolute) return;
    out.push(absolute);
  });
  root.querySelectorAll("[style*='background-image']").forEach((el) => {
    const style = (el as HTMLElement).getAttribute("style") ?? "";
    const m = style.match(/url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/);
    if (!m?.[1]) return;
    const url = m[1].trim();
    const absolute = toAbsoluteImageUrl(url, baseUrl);
    if (absolute) out.push(absolute);
  });
  root.querySelectorAll("source[srcset]").forEach((el) => {
    const srcset = el.getAttribute("srcset");
    if (!srcset?.trim()) return;
    const picked = pickLargestUrlFromSrcset(srcset, baseUrl);
    if (picked) out.push(picked);
  });
  return out;
}

/**
 * scope 내부의 모든 이미지 소스 수집 (raw, 필터 없음).
 * - img[src], [data-src], [data-original], [srcset] (getImageUrl)
 * - picture source[srcset]
 * - [style*="background-image"]
 * - swiper 구조: .swiper-wrapper .swiper-slide 내 img 포함 (비활성 슬라이드까지).
 */
export function collectAllImageUrlsInScope(container: Element, baseUrl: string): string[] {
  const out: string[] = [];
  const push = (url: string) => {
    const a = toAbsoluteImageUrl(url, baseUrl);
    if (a) out.push(a);
  };

  container.querySelectorAll("img[src], img[data-src], img[data-original], img[srcset]").forEach((el) => {
    const url = getImageUrl(el as HTMLImageElement);
    if (url) push(url);
  });
  container.querySelectorAll("picture source[srcset], source[srcset]").forEach((el) => {
    const srcset = el.getAttribute("srcset");
    if (srcset?.trim()) {
      const picked = pickLargestUrlFromSrcset(srcset, baseUrl);
      if (picked) push(picked);
    }
  });
  container.querySelectorAll("[style*='background-image']").forEach((el) => {
    const style = (el as HTMLElement).getAttribute("style") ?? "";
    const m = style.match(/url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/);
    if (m?.[1]) push(m[1].trim());
  });

  const slideSelectors = [".swiper-wrapper img", ".swiper-slide img", "[class*='swiper-slide'] img", "[class*='swiper-wrapper'] img"];
  for (const sel of slideSelectors) {
    try {
      container.querySelectorAll(sel).forEach((el) => {
        const url = getImageUrl(el as HTMLImageElement);
        if (url) push(url);
      });
    } catch {
      continue;
    }
  }
  return out;
}

/**
 * itinerary 전용 제외 여부. 썸네일/리사이즈/작은 이미지는 제외하지 않음.
 */
export function isItineraryExcludedUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (ITINERARY_EXCLUDE_DATA.test(url) && !lower.startsWith("data:http")) return true;
  if (ITINERARY_EXCLUDE_EXT.test(lower)) return true;
  if (ITINERARY_EXCLUDE_TRACKING.test(lower)) return true;
  if (ITINERARY_EXCLUDE_AIR_LOGO.test(url)) return true;
  if (ITINERARY_EXCLUDE_POLICY.test(lower)) return true;
  try {
    const host = new URL(url, "https://x").hostname.toLowerCase();
    if (/doubleclick|google-analytics|tracking/.test(host)) return true;
  } catch {
    // ignore
  }
  return false;
}

/**
 * itinerary 영역 전용 수집: scope 내 모든 이미지 소스 (collectAllImageUrlsInScope와 동일).
 */
export function extractItineraryImageUrlsFromNode(node: Element, baseUrl: string): string[] {
  return collectAllImageUrlsInScope(node, baseUrl);
}

/**
 * itinerary 전용 필터: 최소한의 hard exclude만 적용, 썸네일/리사이즈는 유지.
 * dedupe는 보수적(동일 URL만 제거).
 */
export function filterItineraryImageUrls(
  urls: string[],
  baseUrl: string = typeof document !== "undefined" ? document.baseURI || location.href : "https://www.modetour.com/",
): string[] {
  const absolute: string[] = [];
  for (const u of urls) {
    const a = toAbsoluteImageUrl(u, baseUrl);
    if (a && !isItineraryExcludedUrl(a)) absolute.push(a);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of absolute) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

/**
 * URL 배열 필터 (hard exclude 전용 + dedupe + soft ranking).
 * 1) absolute URL 정리
 * 2) 명백한 비상품 이미지 hard exclude (getExclusionReason만 사용; 썸네일은 null 반환으로 제외 안 함)
 * 3) normalizeImageUrl / normalizedKeyForDedupe 기준 dedupe
 * 4) imagePriorityScore로 우선순위 정렬 (썸네일은 낮은 점수로 뒤로만 밀림)
 * 검증(validateImageUrl)은 호출하지 않음.
 */
export function filterUsefulImageUrls(
  urls: string[],
  baseUrl: string = typeof document !== "undefined" ? document.baseURI || location.href : "https://www.modetour.com/",
  debug?: ImageDebugCounters,
): string[] {
  const totalFound = urls.length;
  const absolute: string[] = [];
  for (const u of urls) {
    const a = toAbsoluteImageUrl(u, baseUrl);
    if (a) absolute.push(a);
  }

  const afterFilter: string[] = [];
  for (const url of absolute) {
    const reason = getExclusionReason(url);
    if (reason) {
      if (debug && reason in debug) (debug[reason] as number) += 1;
      continue;
    }
    afterFilter.push(url);
  }

  if (debug) {
    debug.totalFound = totalFound;
    debug.totalAfterFilter = afterFilter.length;
  }

  const deduped = normalizeAndDedupe(afterFilter);
  if (debug) {
    debug.excludedDuplicate = afterFilter.length - deduped.length;
  }

  return deduped.sort((a, b) => imagePriorityScore(b) - imagePriorityScore(a));
}

const MIN_SIZE_DEFAULT = 80;

/**
 * 노드 내부 이미지 수집 + 요소 크기 필터 (naturalWidth/naturalHeight 또는 getBoundingClientRect).
 */
export function extractImageUrlsFromNodeWithSizeFilter(
  container: Element,
  minW: number = MIN_SIZE_DEFAULT,
  minH: number = MIN_SIZE_DEFAULT,
): string[] {
  const baseUrl = getBaseUrlFromNode(container);
  const out: string[] = [];
  container.querySelectorAll("img[src], img[data-src], img[data-original], img[srcset]").forEach((el) => {
    const img = el as HTMLImageElement;
    const url = getImageUrl(img);
    if (!url) return;
    const absolute = toAbsoluteImageUrl(url, baseUrl);
    if (!absolute || isClearlyNonProductImage(absolute)) return;
    const rect = img.getBoundingClientRect();
    const w = img.naturalWidth ?? img.width ?? rect.width;
    const h = img.naturalHeight ?? img.height ?? rect.height;
    if (typeof w === "number" && typeof h === "number" && (w < minW || h < minH)) return;
    if (rect.width < minW || rect.height < minH) return;
    out.push(absolute);
  });
  container.querySelectorAll("[style*='background-image']").forEach((el) => {
    const style = (el as HTMLElement).getAttribute("style") ?? "";
    const m = style.match(/url\s*\(\s*['"]?([^'")\s]+)['"]?\s*\)/);
    if (!m?.[1]) return;
    const absolute = toAbsoluteImageUrl(m[1].trim(), baseUrl);
    if (!absolute || isClearlyNonProductImage(absolute)) return;
    const rect = (el as HTMLElement).getBoundingClientRect();
    if (rect.width >= minW && rect.height >= minH) out.push(absolute);
  });
  container.querySelectorAll("source[srcset]").forEach((el) => {
    const srcset = el.getAttribute("srcset");
    if (!srcset?.trim()) return;
    const picked = pickLargestUrlFromSrcset(srcset, baseUrl);
    if (!picked || isClearlyNonProductImage(picked)) return;
    const rect = (el as HTMLElement).getBoundingClientRect();
    if (rect.width >= minW && rect.height >= minH) out.push(picked);
  });
  return normalizeAndDedupe(out);
}

/**
 * 노드 내부에서 이미지 URL만 수집 (필터 없음). 절대 URL로 반환.
 * totalFound 등 디버그용.
 */
export function collectImageUrlsRaw(container: Element): string[] {
  const baseUrl = getBaseUrlFromNode(container);
  return collectFromNode(container, baseUrl);
}

/**
 * scope 루트 내 raw 이미지 URL 수집 (필터 없음).
 */
export function collectImageUrlsRawFromDom(root?: Element | Document): string[] {
  if (typeof document === "undefined") return [];
  const scope = root ?? document.body;
  const el = scope instanceof Document ? scope.body : scope;
  if (!el) return [];
  const baseUrl = el instanceof Element ? getBaseUrlFromNode(el) : (document.defaultView?.location?.href ?? "https://www.modetour.com/");
  return collectFromNode(el, baseUrl);
}

const HERO_IMAGES_MAX_DEFAULT = 10;

/**
 * 히어로 영역에서 이미지 다수 수집 (대표 1장 외 갤러리용).
 * heroSelectors 각 항목으로 querySelectorAll 후 getImageUrl 적용, 명백한 비상품/로고 제외, dedupe, 최대 maxCount장.
 */
export function collectHeroImageUrls(
  doc: Document,
  baseUrl: string,
  heroSelectors: readonly string[],
  maxCount: number = HERO_IMAGES_MAX_DEFAULT,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const sel of heroSelectors) {
    try {
      doc.querySelectorAll(sel).forEach((el) => {
        if (out.length >= maxCount) return;
        const img = el as HTMLImageElement;
        const url = getImageUrl(img);
        if (!url) return;
        const absolute = toAbsoluteImageUrl(url, baseUrl);
        if (!absolute || isClearlyNonProductImage(absolute) || isAirlineLogoUrl(absolute)) return;
        const key = normalizedKeyForDedupe(absolute);
        if (seen.has(key)) return;
        seen.add(key);
        out.push(absolute);
      });
    } catch {
      continue;
    }
  }
  return out.slice(0, maxCount);
}

/**
 * 특정 노드 내부에서만 이미지 URL 수집 (필터 적용).
 */
export function extractImageUrlsFromNode(container: Element): string[] {
  const baseUrl = getBaseUrlFromNode(container);
  const raw = collectFromNode(container, baseUrl);
  return filterUsefulImageUrls(raw, baseUrl);
}

/**
 * scope 루트(Element 또는 document) 내 이미지 수집. root 미지정 시 document.body.
 */
export function extractImageUrlsFromDom(root?: Element | Document): string[] {
  if (typeof document === "undefined") return [];
  const scope = root ?? document.body;
  const el = scope instanceof Document ? scope.body : scope;
  if (!el) return [];
  const baseUrl = el instanceof Element ? getBaseUrlFromNode(el) : (document.defaultView?.location?.href ?? "https://www.modetour.com/");
  const raw = collectFromNode(el, baseUrl);
  return filterUsefulImageUrls(raw, baseUrl).slice(0, GALLERY_MAX);
}

export function isAirlineLogoUrl(url: string): boolean {
  try {
    const u = new URL(url, "https://x");
    return u.hostname.toLowerCase() === "img.modetour.com" && /\/air\/logo\//i.test(u.pathname);
  } catch {
    return false;
  }
}

/**
 * Hero 후보 목록 (og:image, JSON-LD, 첫 activity 이미지, DOM 첫 유효).
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
    const fromDom = extractImageUrlsFromDom(document.body);
    if (fromDom[0]) candidates.push(fromDom[0]);
  }
  const deduped = normalizeAndDedupe(candidates);
  return deduped.filter((u) => !isAirlineLogoUrl(u));
}

/**
 * Hero 이미지 1개 선정: 후보 목록에서 첫 번째 유효 URL.
 */
export function pickHeroImage(
  imageUrls: string[],
  jsonLdHero?: string,
  firstActivityFirstImage?: string,
): string | undefined {
  const candidates = getHeroCandidates(jsonLdHero, firstActivityFirstImage);
  for (const u of candidates) {
    if (!isClearlyNonProductImage(u) && !isAirlineLogoUrl(u)) return normalizedKeyForDedupe(u);
  }
  if (imageUrls.length > 0) {
    const first = imageUrls.find((u) => !isClearlyNonProductImage(u) && !isAirlineLogoUrl(u));
    if (first) return normalizedKeyForDedupe(first);
  }
  return undefined;
}

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
