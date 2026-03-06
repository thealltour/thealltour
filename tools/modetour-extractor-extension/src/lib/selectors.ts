/**
 * 모두투어 상품 상세 페이지 DOM 셀렉터 모음.
 * 못 찾으면 warnings로 남기고, raw 스니펫으로 대체.
 */

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
  /** 일정 루트 컨테이너 */
  itineraryRoot: [
    "#itinerary",
    ".itinerary",
    ".pkg-itinerary",
    "[class*='itinerary']",
    ".schedule-detail",
    ".day-schedule",
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
 * 이미지 URL 추출: src, data-src, data-original, srcset 첫 URL
 */
export function getImageUrl(img: HTMLImageElement): string | null {
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

/**
 * 텍스트 잘라내기 (raw 스니펫용)
 */
export function truncateSnippet(text: string, maxLen: number = MAX_SNIPPET_LEN): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + "\n…(truncated)";
}
