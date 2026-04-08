/**
 * 모두투어 상품 상세 페이지 DOM 셀렉터 모음.
 * 못 찾으면 warnings로 남기고, raw 스니펫으로 대체.
 */

import { collectPreferredImgCandidates } from "~lib/images";

export const SELECTORS = {
  /** 상품명 (메인 타이틀) */
  title: [
    "h1.pkg-title",
    "h1.title",
    ".product-title h1",
    ".pkg-detail-title",
    "[class*='productName']",
    "[class*='packageTitle']",
    "h1",
  ],
  /** 요약/설명 한 줄 */
  summary: [
    ".pkg-summary",
    ".product-summary",
    "[class*='summary']",
    ".subtitle",
  ],
  /** 가격 영역 */
  price: [
    ".price-wrap",
    ".pkg-price",
    "[class*='price']",
    ".product-price",
  ],
  /** 여행 기간/지역 텍스트 (n박 m일, 지역명 등) */
  meta: [
    ".pkg-info",
    ".product-meta",
    "[class*='nights']",
    "[class*='duration']",
    ".info-tags",
  ],
  /** 일정 루트 컨테이너 (이미지 수집용 scope) */
  itineraryRoot: [
    "#itinerary",
    ".itinerary",
    ".pkg-itinerary",
    "[class*='itinerary']",
    ".schedule-detail",
    ".day-schedule",
  ],
  /** 히어로 갤러리 루트: 메인 상품 이미지가 들어 있는 컨테이너 (active + 비활성 slide 포함) */
  heroGalleryRoot: [
    ".swiper-container",
    ".swiper",
    "[class*='PackageDetailGallery']",
    "[class*='DetailGallery']",
    ".pkg-hero",
    ".hero-image",
    ".detail-gallery",
    "[class*='detail-gallery']",
    ".gallery-main",
    "[class*='gallery'] .swiper",
    "[class*='hero'] .swiper",
    ".main-image",
    "[class*='mainImage']",
  ],
  /** 히어로 슬라이드 컨테이너: 모든 슬라이드가 모인 wrapper (heroGalleryRoot 내부) */
  heroSlideContainer: [
    ".swiper-wrapper",
    "[class*='swiper-wrapper']",
    ".swiper-slide",
    "[class*='swiper-slide']",
  ],
  /** 일정 내 이미지가 들어 있는 블록 (Day/Event 콘텐츠 루트) */
  itineraryImageRoot: [
    "[class*='itinerary'] [class*='content']",
    "[class*='schedule'] [class*='content']",
    ".swiper-thumbs",
    "[class*='swiper-thumbs']",
    "[class*='day'] img",
    "[class*='event'] img",
  ],
  /** Day N 일차 섹션 */
  daySection: [
    "[class*='day']",
    ".day-item",
    ".schedule-day",
    "section[class*='day']",
  ],
  /** 포함 항목 섹션 */
  inclusions: [
    "#inclusion",
    ".inclusion",
    "[class*='inclusion']",
    "[class*='포함']",
  ],
  /** 불포함/제외 */
  exclusions: [
    "[class*='exclusion']",
    "[class*='불포함']",
  ],
  /** 약관/유의사항/취소규정 */
  terms: [
    "#terms",
    ".terms",
    "[class*='terms']",
    "[class*='약관']",
    "[class*='취소']",
    "[class*='유의사항']",
  ],
  /** 대표(히어로) 이미지 */
  heroImage: [
    ".pkg-hero img",
    ".hero-image img",
    ".main-image img",
    "[class*='hero'] img",
    ".gallery-main img",
    ".swiper-slide-active img",
    ".detail-gallery img",
  ],
  /** 갤러리 이미지 목록 */
  galleryImages: [
    ".pkg-gallery img",
    ".gallery-list img",
    "[class*='gallery'] img",
    ".thumb-list img",
    ".detail-images img",
  ],
  /** 상품 상세 본문 영역 (일정/약관/포함/추천/하단 배너 제외) */
  detailContent: [
    ".pkg-detail-content",
    ".product-detail-body",
    "[class*='detailContent']",
    "[class*='productDetail']",
    "main .content",
    "main",
  ],
} as const;

const MAX_SNIPPET_LEN = 5000;

/**
 * 주어진 셀렉터 배열 중 처음 매칭되는 요소 반환. 없으면 null.
 */
export function queryFirst(
  doc: Document,
  selectors: readonly string[],
): Element | null {
  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel);
      if (el) return el;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * 주어진 셀렉터 배열 중 처음 매칭되는 요소의 텍스트. 공백 정리.
 */
export function queryText(
  doc: Document,
  selectors: readonly string[],
): string | null {
  const el = queryFirst(doc, selectors);
  if (!el) return null;
  const text = el.textContent?.trim() ?? "";
  return text || null;
}

/**
 * srcset 문자열 파싱: "url 320w, url2 640w" → 후보 배열.
 * 각 후보는 { url, w?, x? } 형태. w(픽셀 너비) 또는 x(픽셀 밀도) descriptor 지원.
 */
function parseSrcsetEntries(srcset: string, baseUrl: string): Array<{ url: string; w?: number; x?: number }> {
  const entries: Array<{ url: string; w?: number; x?: number }> = [];
  const parts = srcset.split(",").map((p) => p.trim()).filter(Boolean);
  for (const part of parts) {
    const tokens = part.split(/\s+/);
    const urlRaw = tokens[0];
    if (!urlRaw) continue;
    const url = urlRaw.startsWith("http") ? urlRaw : new URL(urlRaw, baseUrl).href;
    const descriptor = tokens[1];
    if (descriptor?.endsWith("w")) {
      const w = parseInt(descriptor.slice(0, -1), 10);
      if (Number.isFinite(w)) entries.push({ url, w });
      else entries.push({ url });
    } else if (descriptor?.endsWith("x")) {
      const x = parseFloat(descriptor.slice(0, -1));
      if (Number.isFinite(x)) entries.push({ url, x });
      else entries.push({ url });
    } else {
      entries.push({ url });
    }
  }
  return entries;
}

/**
 * srcset 후보 중 "가장 큰" URL 선택: 1) w 최대 → 2) x 최대 → 3) 마지막 후보.
 */
export function pickLargestUrlFromSrcset(srcset: string, baseUrl: string): string | null {
  const entries = parseSrcsetEntries(srcset, baseUrl);
  if (entries.length === 0) return null;
  const withW = entries.filter((e) => e.w != null);
  if (withW.length > 0) {
    const best = withW.reduce((a, b) => ((a.w ?? 0) >= (b.w ?? 0) ? a : b));
    return best.url.trim();
  }
  const withX = entries.filter((e) => e.x != null);
  if (withX.length > 0) {
    const best = withX.reduce((a, b) => ((a.x ?? 0) >= (b.x ?? 0) ? a : b));
    return best.url.trim();
  }
  return entries[entries.length - 1].url.trim();
}

/**
 * 단일 후보 URL (레거시 헬퍼). PR-IMAGE-2: lazy 우선순위·srcset 고해상도는 collectPreferredImgCandidates와 동일.
 */
export function getImageUrl(img: HTMLImageElement): string | null {
  const base =
    (img.ownerDocument?.defaultView as Window | undefined)?.location?.href ??
    "https://www.modetour.com/";
  const list = collectPreferredImgCandidates(img, base);
  return list[0] ?? null;
}

/**
 * 텍스트 잘라내기 (raw 스니펫용)
 */
export function truncateSnippet(text: string, maxLen: number = MAX_SNIPPET_LEN): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + "\n…(truncated)";
}
