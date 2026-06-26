/**
 * PR-IMAGE-1: 이미지 후보 최대 수집.
 * PR-IMAGE-2: srcset 최적 해상도, picture>source 우선, lazy 속성 순위, 동일 이미지군 대표 선택(점수).
 * validateImageUrl 은 선택 검증용 (기본 파이프라인 미사용).
 */

import type { ExtractMeta } from "~lib/extractTypes";

export type ImageDebugCounters = NonNullable<ExtractMeta["imageDebug"]>;

const GALLERY_MAX = 150;
/** 상품 상단 갤러리(대표 포함) — 관리자 MultiImageUploadField maxCount 와 동일 */
export const PRODUCT_GALLERY_MAX = 10;
const ITINERARY_IMAGES_PER_DAY_MAX = 12;
const GALLERY_COUNTER_REGEX = /\b(\d{1,2})\s*\/\s*(\d{1,2})\b/;

const URL_IN_BG = /url\s*\(\s*["']?([^)"']+)["']?\s*\)/gi;

function isHanatourHost(hostname: string): boolean {
  return hostname.toLowerCase().endsWith("hanatour.com");
}

/** 하나투어 CDN http → https */
export function upgradeHanatourImageUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    if (u.protocol === "http:" && isHanatourHost(u.hostname)) {
      u.protocol = "https:";
      return u.href;
    }
    return url.trim();
  } catch {
    return url;
  }
}

/** 일정 UI 스톡 아이콘 (caution_freeTime 등) — 갤러리에서 제외 */
export function isHanatourUiStockImage(url: string): boolean {
  try {
    const u = new URL(url.trim(), "https://x");
    if (!isHanatourHost(u.hostname)) return false;
    const path = u.pathname.toLowerCase();
    if (/\/schedule\/caution_/i.test(path)) return true;
    if (/\/schedule\//i.test(path) && /caution|icon|btn|arrow|freetime/i.test(path)) return true;
    return false;
  } catch {
    return false;
  }
}

/** ----- URL 정규화 (dedupe 키용 함수는 대표 선택보다 위에 두어야 함) ----- */

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

export function normalizeHanatourImageUrl(url: string): string {
  try {
    const u = new URL(url, "https://x");
    const path = u.pathname;
    const host = u.hostname.toLowerCase();
    const isEagle = host === "image.hanatour.com" && path.includes("/eagle/photoimg/");
    /** eagle: 리사이즈·해상도 구분을 위해 쿼리 유지, 추적·캐시 파라미터만 제거 */
    if (isEagle) {
      const dropOnly = new Set([
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_content",
        "utm_term",
        "cache",
        "v",
        "ver",
        "t",
        "timestamp",
      ]);
      u.searchParams.forEach((_, k) => {
        const low = k.toLowerCase();
        if (dropOnly.has(low) || /^_\d+$/.test(low)) u.searchParams.delete(k);
      });
      return u.href;
    }
    if (/\.(jpe?g|png|webp|avif|gif|svg|bmp)(\?|$)/i.test(path)) {
      u.search = "";
      return u.href;
    }
    const dropParams = new Set([
      "resize",
      "resize_w",
      "resize_h",
      "w",
      "h",
      "width",
      "height",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "cache",
      "v",
      "ver",
      "t",
      "timestamp",
      "quality",
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
 * 느슨한 dedupe 키(레거시·selectRepresentativeUrls용).
 * 수집 파이프라인은 finalizeOpenImageUrlsPreserveAll 로 완전 동일 URL만 제거.
 */
export function normalizedKeyForDedupe(url: string): string {
  try {
    const u = new URL(url, "https://x");
    if (u.hostname.toLowerCase() === "image.hanatour.com" && u.pathname.includes("/eagle/photoimg/")) {
      return normalizeHanatourImageUrl(url);
    }
    return normalizeImageUrl(url);
  } catch {
    return url;
  }
}

/** PR-IMG-MODETOUR-REVIEW-1: 수집 단계 — 절대 URL 기준 문자열이 완전히 같을 때만 중복 제거 */
export function finalizeOpenImageUrlsPreserveAll(
  candidates: string[],
  baseUrl: string,
  debug?: ImageDebugCounters,
): string[] {
  const normalized: string[] = [];
  for (const c of candidates) {
    const n = normalizeOpenImageUrl(c, baseUrl);
    if (n) normalized.push(n);
  }
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of normalized) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  if (typeof console !== "undefined" && console.log) {
    console.log("[IMAGE][PRESERVE_ALL]", { raw: candidates.length, normalized: normalized.length, unique: out.length });
  }
  if (debug) {
    debug.excludedDuplicate = (debug.excludedDuplicate ?? 0) + (normalized.length - out.length);
  }
  return out;
}

export type CollectImageHeuristicMeta = {
  isThumbnailCandidate: boolean;
  isLogoCandidate: boolean;
  isLowResolution: boolean;
};

/** 자동 제거 금지 — 관리자 배지용 휴리스틱만 */
export function buildImageHeuristicMeta(url: string): CollectImageHeuristicMeta {
  const lower = url.toLowerCase();
  let airlineLogo = false;
  try {
    const u = new URL(url, "https://x");
    airlineLogo =
      u.hostname.toLowerCase() === "image.hanatour.com" && /\/air\/logo\//i.test(u.pathname);
  } catch {
    /* ignore */
  }
  const isLogoCandidate =
    airlineLogo || (/\blogo\b/i.test(lower) && /\.(png|svg|webp|gif)(\?|$)/i.test(lower));
  const isThumbnailCandidate = /\b(thumb|thumbnail|small|mini)\b/i.test(lower);
  let isLowResolution = isThumbnailCandidate;
  const rw = lower.match(/\b(?:resize_w|resize_h)\s*=\s*(\d+)/);
  if (rw && parseInt(rw[1], 10) > 0 && parseInt(rw[1], 10) < 360) isLowResolution = true;
  return { isThumbnailCandidate, isLogoCandidate, isLowResolution };
}

export function buildImageHintsByUrl(urls: readonly string[]): Record<string, CollectImageHeuristicMeta> {
  const out: Record<string, CollectImageHeuristicMeta> = {};
  for (const u of urls) {
    const t = u?.trim();
    if (t) out[t] = buildImageHeuristicMeta(t);
  }
  return out;
}

export function toAbsoluteImageUrl(url: string, base: string): string {
  return normalizeOpenImageUrl(url, base) ?? "";
}

export function normalizeOpenImageUrl(url: string, baseHref: string): string | null {
  if (!url?.trim()) return null;
  const u = url.trim();
  const head = u.slice(0, 12).toLowerCase();
  if (head.startsWith("javascript:")) return null;
  if (head.startsWith("data:")) return null;
  try {
    const abs = new URL(u, baseHref).href;
    if (isHanatourUiStockImage(abs)) return null;
    return upgradeHanatourImageUrl(abs);
  } catch {
    return null;
  }
}

/** ----- srcset: w 우선, 그다음 x, descriptor 없음은 0으로 동률 ----- */

export type SrcSetCandidate = {
  url: string;
  width?: number;
  density?: number;
};

export function parseSrcSetCandidates(srcset?: string | null): SrcSetCandidate[] {
  if (!srcset?.trim()) return [];
  return srcset
    .split(",")
    .map((part) => part.trim())
    .map((part) => {
      const tokens = part.split(/\s+/).filter(Boolean);
      const url = tokens[0];
      if (!url) return null;
      const descriptor = tokens[1];
      if (!descriptor) return { url };
      if (descriptor.endsWith("w")) {
        const width = parseInt(descriptor.slice(0, -1), 10);
        return { url, width: Number.isFinite(width) ? width : undefined };
      }
      if (descriptor.endsWith("x")) {
        const density = parseFloat(descriptor.slice(0, -1));
        return { url, density: Number.isFinite(density) ? density : undefined };
      }
      return { url };
    })
    .filter((x): x is SrcSetCandidate => x != null);
}

/** 고해상도 → 저해상도 순 절대 URL 배열 (중복 제거 유지 순서) */
export function pickBestSrcSetUrls(srcset: string | null | undefined, baseUrl: string): string[] {
  const parsed = parseSrcSetCandidates(srcset);
  if (parsed.length === 0) return [];
  const sorted = [...parsed].sort((a, b) => {
    const aw = a.width ?? 0;
    const bw = b.width ?? 0;
    if (aw !== bw) return bw - aw;
    const ad = a.density ?? 0;
    const bd = b.density ?? 0;
    if (ad !== bd) return bd - ad;
    return 0;
  });
  const out: string[] = [];
  const seen = new Set<string>();
  for (const c of sorted) {
    const abs = normalizeOpenImageUrl(c.url, baseUrl);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  if (typeof console !== "undefined" && console.log && srcset?.trim() && parsed.length > 1) {
    console.log("[IMAGE][SRCSET_PICK]", {
      input: srcset.length > 220 ? `${srcset.slice(0, 220)}…` : srcset,
      picked: out[0] ?? null,
      variantCount: out.length,
    });
  }
  return out;
}

/** 레거시: URL 문자열만 (descriptor 무시 시절 호환) */
export function parseSrcSetAll(srcset?: string | null): string[] {
  return parseSrcSetCandidates(srcset).map((c) => c.url);
}

/** 동일 이미지군 내 대표 고를 때만 점수 (차단 아님) */
export function scoreImageCandidate(url: string): number {
  let score = 0;
  try {
    const lower = url.toLowerCase();
    if (lower.includes("/eagle/photoimg/")) score += 30;
    if (isHanatourUiStockImage(url)) score -= 100;
    if (/\bresize_w=\d+/i.test(lower)) score -= 10;
    if (/\bresize_h=\d+/i.test(lower)) score -= 10;
    if (lower.includes("thumb")) score -= 12;
    if (lower.includes("thumbnail")) score -= 12;
    if (lower.includes("small")) score -= 8;
    if (/\.(jpg|jpeg|png|webp|avif|gif|svg|bmp)(\?|$)/i.test(lower)) score += 5;
    const u = new URL(url);
    if (!u.search || u.search === "?") score += 4;
  } catch {
    /* ignore */
  }
  return score;
}

/**
 * lazy/표시 우선순위: data-original → data-src 계열 → srcset(고해상도 우선) → currentSrc → src.
 * 반환은 절대 URL, 입력 순서대로 중복 제거.
 */
export function collectPreferredImgCandidates(img: HTMLImageElement, baseUrl: string): string[] {
  const raw: string[] = [];
  for (const attr of [
    img.getAttribute("data-original"),
    img.getAttribute("data-src"),
    img.getAttribute("data-lazy-src"),
    img.getAttribute("data-lazy"),
    img.getAttribute("data-url"),
  ]) {
    if (attr?.trim()) raw.push(attr.trim());
  }
  raw.push(...pickBestSrcSetUrls(img.getAttribute("srcset"), baseUrl));
  raw.push(...pickBestSrcSetUrls(img.getAttribute("data-srcset"), baseUrl));
  if (img.currentSrc?.trim()) raw.push(img.currentSrc.trim());
  if (img.src?.trim()) raw.push(img.src.trim());
  const sAttr = img.getAttribute("src");
  if (sAttr?.trim()) raw.push(sAttr.trim());

  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const abs = normalizeOpenImageUrl(r, baseUrl);
    if (!abs || seen.has(abs)) continue;
    seen.add(abs);
    out.push(abs);
  }
  return out;
}

/** picture: source srcset 먼저(고해상도 순), 이후 내부 img preferred */
export function collectPictureCandidates(picture: HTMLPictureElement, baseUrl: string): string[] {
  const urls: string[] = [];
  picture.querySelectorAll("source").forEach((source) => {
    const ss = source.getAttribute("srcset");
    urls.push(...pickBestSrcSetUrls(ss, baseUrl));
    const sh = source.getAttribute("src");
    const abs = normalizeOpenImageUrl(sh, baseUrl);
    if (abs) urls.push(abs);
  });
  const innerImg = picture.querySelector("img");
  if (innerImg) urls.push(...collectPreferredImgCandidates(innerImg, baseUrl));
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(u);
  }
  return out;
}

function extractInlineBackgroundUrls(root: Element): string[] {
  const urls: string[] = [];
  root.querySelectorAll("[style*='url']").forEach((el) => {
    const s = (el as HTMLElement).getAttribute("style") ?? "";
    let m: RegExpExecArray | null;
    const re = new RegExp(URL_IN_BG.source, "gi");
    while ((m = re.exec(s)) !== null) {
      if (m[1]?.trim()) urls.push(m[1].trim());
    }
  });
  return urls;
}

function extractComputedBackgroundUrls(container: Element): string[] {
  const win = container.ownerDocument?.defaultView;
  if (!win) return [];
  const urls: string[] = [];
  const visit = (el: Element) => {
    try {
      const bg = win.getComputedStyle(el).backgroundImage;
      if (!bg || bg === "none") return;
      let m: RegExpExecArray | null;
      const re = new RegExp(URL_IN_BG.source, "gi");
      while ((m = re.exec(bg)) !== null) {
        if (m[1]?.trim()) urls.push(m[1].trim());
      }
    } catch {
      /* ignore */
    }
  };
  visit(container);
  container.querySelectorAll("*").forEach(visit);
  return urls;
}

/** 원시 후보: picture 우선 수집, img는 picture 밖만, source는 picture 밖만 */
export function collectOpenImageCandidatesRaw(container: Element, baseUrl: string): string[] {
  const candidates: string[] = [];
  const pushAll = (arr: string[]) => {
    for (const x of arr) {
      if (x) candidates.push(x);
    }
  };

  container.querySelectorAll("picture").forEach((p) => {
    pushAll(collectPictureCandidates(p as HTMLPictureElement, baseUrl));
  });

  container.querySelectorAll("img").forEach((el) => {
    if (el.closest("picture")) return;
    pushAll(collectPreferredImgCandidates(el as HTMLImageElement, baseUrl));
  });

  container.querySelectorAll("source[srcset], source[src]").forEach((el) => {
    if (el.closest("picture")) return;
    const srcset = el.getAttribute("srcset");
    if (srcset?.trim()) pushAll(pickBestSrcSetUrls(srcset, baseUrl));
    const src = el.getAttribute("src");
    const abs = normalizeOpenImageUrl(src, baseUrl);
    if (abs) candidates.push(abs);
  });

  for (const r of extractInlineBackgroundUrls(container)) {
    const abs = normalizeOpenImageUrl(r, baseUrl);
    if (abs) candidates.push(abs);
  }
  for (const r of extractComputedBackgroundUrls(container)) {
    const abs = normalizeOpenImageUrl(r, baseUrl);
    if (abs) candidates.push(abs);
  }

  container.querySelectorAll('link[rel="preload"][as="image"]').forEach((el) => {
    const href = el.getAttribute("href");
    const abs = normalizeOpenImageUrl(href, baseUrl);
    if (abs) candidates.push(abs);
  });

  const slideSelectors = [
    ".swiper-wrapper img",
    ".swiper-slide img",
    "[class*='swiper-slide'] img",
    "[class*='swiper-wrapper'] img",
  ];
  for (const sel of slideSelectors) {
    try {
      container.querySelectorAll(sel).forEach((el) => {
        if ((el as Element).closest("picture")) return;
        pushAll(collectPreferredImgCandidates(el as HTMLImageElement, baseUrl));
      });
    } catch {
      continue;
    }
  }

  return candidates;
}

/** 컨테이너에서 후보 수집 후 완전 동일 URL만 제거 (썸네일·변형 URL 최대 보존) */
export function collectAllImageUrlsPreserveAll(container: Element, baseUrl: string): string[] {
  return finalizeOpenImageUrlsPreserveAll(collectOpenImageCandidatesRaw(container, baseUrl), baseUrl);
}

const REPRESENTATIVE_LOG_MAX = 8;

/** normalizedKey 그룹당 점수 최고 1개, 전체는 점수 내림차순 */
export function selectRepresentativeUrls(absoluteUrls: string[], verboseLog = true): string[] {
  const groups = new Map<string, string[]>();
  for (const url of absoluteUrls) {
    const key = normalizedKeyForDedupe(url);
    const list = groups.get(key) ?? [];
    list.push(url);
    groups.set(key, list);
  }
  const result: string[] = [];
  let logged = 0;
  for (const [groupKey, groupCandidates] of groups) {
    if (groupCandidates.length === 0) continue;
    const sorted = [...groupCandidates].sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));
    const best = sorted[0];
    if (best) {
      result.push(best);
      if (
        verboseLog &&
        typeof console !== "undefined" &&
        console.log &&
        groupCandidates.length > 1 &&
        logged < REPRESENTATIVE_LOG_MAX
      ) {
        console.log("[IMAGE][REPRESENTATIVE_SELECTED]", {
          groupKey: groupKey.slice(0, 96),
          candidates: groupCandidates,
          selected: best,
        });
        logged += 1;
      }
    }
  }
  return result.sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));
}

export function finalizeOpenImageUrls(
  candidates: string[],
  baseUrl: string,
  debug?: ImageDebugCounters,
): string[] {
  const normalized: string[] = [];
  for (const c of candidates) {
    const n = normalizeOpenImageUrl(c, baseUrl);
    if (n) normalized.push(n);
  }
  if (typeof console !== "undefined" && console.log) {
    console.log("[IMAGE][TOTAL_COLLECTED]", candidates.length);
    console.log("[IMAGE][NORMALIZED]", normalized.length);
  }
  const representatives = selectRepresentativeUrls(normalized, true);
  if (typeof console !== "undefined" && console.log) {
    console.log("[IMAGE][AFTER_REPRESENTATIVES]", representatives.length);
  }
  if (debug) {
    debug.excludedDuplicate = (debug.excludedDuplicate ?? 0) + (normalized.length - representatives.length);
  }
  return representatives;
}

function getBaseUrlFromNode(node: Element): string {
  const doc = node.ownerDocument;
  return (doc?.defaultView as Window | undefined)?.location?.href ?? "https://www.hanatour.com/";
}

export function collectAllImageUrlsInScope(container: Element, baseUrl: string): string[] {
  return finalizeOpenImageUrlsPreserveAll(collectOpenImageCandidatesRaw(container, baseUrl), baseUrl);
}

export function filterItineraryImageUrls(
  urls: string[],
  baseUrl: string = typeof document !== "undefined" ? document.baseURI || location.href : "https://www.hanatour.com/",
): string[] {
  return finalizeOpenImageUrlsPreserveAll(urls, baseUrl);
}

export function extractItineraryImageUrlsFromNode(node: Element, baseUrl: string): string[] {
  return collectAllImageUrlsInScope(node, baseUrl);
}

/** 점수 기반 제거 없음 — 완전 동일 URL만 제거. debug.totalFound/AfterFilter 설정. */
export function filterUsefulImageUrls(
  urls: string[],
  baseUrl: string = typeof document !== "undefined" ? document.baseURI || location.href : "https://www.hanatour.com/",
  debug?: ImageDebugCounters,
): string[] {
  const out = finalizeOpenImageUrlsPreserveAll(urls, baseUrl, debug);
  if (debug) {
    debug.totalFound = urls.length;
    debug.totalAfterFilter = out.length;
  }
  return out;
}

export function getFirstImageUrlInContainer(container: Element, baseUrl: string): string | undefined {
  const list = collectAllImageUrlsInScope(container, baseUrl);
  if (!list.length) return undefined;
  return [...list].sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a))[0];
}

function collectFromNode(root: Element, baseUrl: string): string[] {
  return collectAllImageUrlsInScope(root, baseUrl);
}

export function extractImageUrlsFromNodeWithSizeFilter(
  container: Element,
  _minW?: number,
  _minH?: number,
): string[] {
  const baseUrl = getBaseUrlFromNode(container);
  return collectAllImageUrlsInScope(container, baseUrl);
}

export function collectImageUrlsRaw(container: Element): string[] {
  return collectFromNode(container, getBaseUrlFromNode(container));
}

export function collectImageUrlsRawFromDom(root?: Element | Document): string[] {
  if (typeof document === "undefined") return [];
  const scope = root ?? document.body;
  const el = scope instanceof Document ? scope.body : scope;
  if (!el) return [];
  const baseUrl =
    el instanceof Element
      ? getBaseUrlFromNode(el)
      : document.defaultView?.location?.href ?? "https://www.hanatour.com/";
  return collectFromNode(el, baseUrl);
}

const HERO_IMAGES_MAX_DEFAULT = 40;

/** 갤러리 카운터(예: 1/9)에서 total 슬라이드 수 파싱 */
export function parseProductGalleryTotalFromDom(scope: Element | Document): number | undefined {
  const root = scope instanceof Document ? scope.body : scope;
  if (!root) return undefined;
  const text = (root as HTMLElement).innerText ?? "";
  const m = text.match(GALLERY_COUNTER_REGEX);
  if (!m) return undefined;
  const total = parseInt(m[2], 10);
  if (!Number.isFinite(total) || total < 1 || total > 30) return undefined;
  return total;
}

/** 슬라이드당 대표 URL 1개 수집 후 상품 갤러리 상한 적용 */
export function collectProductGalleryUrls(
  heroRoot: Element | null,
  doc: Document,
  baseUrl: string,
  maxCount: number = PRODUCT_GALLERY_MAX,
): string[] {
  if (!heroRoot) return [];

  const slideSelectors = [
    ".swiper-slide",
    "[class*='swiper-slide']",
    "[class*='Slide']",
  ];
  const perSlide: string[] = [];
  const seenSlides = new WeakSet<Element>();

  for (const sel of slideSelectors) {
    try {
      heroRoot.querySelectorAll(sel).forEach((slide) => {
        if (seenSlides.has(slide)) return;
        seenSlides.add(slide);
        const candidates: string[] = [];
        slide.querySelectorAll("picture").forEach((p) => {
          candidates.push(...collectPictureCandidates(p as HTMLPictureElement, baseUrl));
        });
        slide.querySelectorAll("img").forEach((img) => {
          if (img.closest("picture")) return;
          candidates.push(...collectPreferredImgCandidates(img as HTMLImageElement, baseUrl));
        });
        const best = finalizeOpenImageUrlsPreserveAll(candidates, baseUrl)
          .sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a))[0];
        if (best) perSlide.push(best);
      });
    } catch {
      continue;
    }
  }

  let urls =
    perSlide.length > 0
      ? finalizeOpenImageUrlsPreserveAll(perSlide, baseUrl)
      : finalizeOpenImageUrlsPreserveAll(collectOpenImageCandidatesRaw(heroRoot, baseUrl), baseUrl);

  const parsedTotal = parseProductGalleryTotalFromDom(heroRoot);
  const cap = parsedTotal != null ? Math.min(parsedTotal, maxCount) : maxCount;
  return urls.slice(0, cap);
}

export function collectHeroImageUrls(
  doc: Document,
  baseUrl: string,
  heroSelectors: readonly string[],
  maxCount: number = HERO_IMAGES_MAX_DEFAULT,
): string[] {
  const candidates: string[] = [];
  const seenPictures = new WeakSet<Element>();
  for (const sel of heroSelectors) {
    try {
      doc.querySelectorAll(sel).forEach((el) => {
        if (!(el instanceof HTMLImageElement)) return;
        const pic = el.closest("picture");
        if (pic) {
          if (!seenPictures.has(pic)) {
            seenPictures.add(pic);
            candidates.push(...collectPictureCandidates(pic as HTMLPictureElement, baseUrl));
          }
        } else {
          candidates.push(...collectPreferredImgCandidates(el, baseUrl));
        }
      });
    } catch {
      continue;
    }
  }
  return finalizeOpenImageUrlsPreserveAll(candidates, baseUrl).slice(0, maxCount);
}

export function extractImageUrlsFromNode(container: Element): string[] {
  return collectAllImageUrlsInScope(container, getBaseUrlFromNode(container));
}

export function extractImageUrlsFromDom(root?: Element | Document): string[] {
  if (typeof document === "undefined") return [];
  const scope = root ?? document.body;
  const el = scope instanceof Document ? scope.body : scope;
  if (!el) return [];
  const baseUrl =
    el instanceof Element
      ? getBaseUrlFromNode(el)
      : document.defaultView?.location?.href ?? "https://www.hanatour.com/";
  return collectAllImageUrlsInScope(el, baseUrl).slice(0, GALLERY_MAX);
}


export function isAirlineLogoUrl(url: string): boolean {
  try {
    const u = new URL(url, "https://x");
    return u.hostname.toLowerCase() === "image.hanatour.com" && /\/air\/logo\//i.test(u.pathname);
  } catch {
    return false;
  }
}

export function getHeroCandidates(jsonLdImage?: string, firstActivityImage?: string): string[] {
  const base =
    typeof document !== "undefined"
      ? document.defaultView?.location?.href ?? "https://www.hanatour.com/"
      : "https://www.hanatour.com/";
  const raw: string[] = [];
  if (typeof document !== "undefined") {
    const og = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
    if (og?.trim()) raw.push(og.trim());
  }
  if (jsonLdImage?.trim()) raw.push(jsonLdImage.trim());
  if (firstActivityImage?.trim()) raw.push(firstActivityImage.trim());
  if (typeof document !== "undefined") {
    raw.push(...extractImageUrlsFromDom(document.body));
  }
  return finalizeOpenImageUrlsPreserveAll(raw, base);
}

export function pickHeroImage(
  imageUrls: string[],
  jsonLdHero?: string,
  firstActivityFirstImage?: string,
): string | undefined {
  const base =
    typeof document !== "undefined"
      ? document.defaultView?.location?.href ?? "https://www.hanatour.com/"
      : "https://www.hanatour.com/";
  for (const u of getHeroCandidates(jsonLdHero, firstActivityFirstImage)) {
    const n = normalizeOpenImageUrl(u, base);
    if (n) return n;
  }
  for (const u of imageUrls) {
    const n = normalizeOpenImageUrl(u, base);
    if (n) return n;
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

const DEFAULT_VALIDATE_TIMEOUT_MS = 3000;

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

export function normalizeAndDedupe(urls: string[]): string[] {
  const base = "https://www.hanatour.com/";
  const seen = new Set<string>();
  const out: string[] = [];
  for (const u of urls) {
    const n = normalizeOpenImageUrl(u, base);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/** 레거시 API */
export function isClearlyNonProductImage(_url: string): boolean {
  return false;
}

export function getExclusionReason(_url: string): keyof ImageDebugCounters | null {
  return null;
}

export function isLikelyThumbnailUrl(_url: string): boolean {
  return false;
}

export function isItineraryExcludedUrl(_url: string): boolean {
    return false;
}

/** @deprecated PR-IMAGE-2: collectPreferredImgCandidates 사용 */
export function collectImgElementSources(img: HTMLImageElement): string[] {
  const base =
    (img.ownerDocument?.defaultView as Window | undefined)?.location?.href ?? "https://www.hanatour.com/";
  return collectPreferredImgCandidates(img, base);
}
