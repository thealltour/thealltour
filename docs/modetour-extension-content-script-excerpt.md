# 모두투어 크롬 익스텐션 — Content Script 및 크롤링 함수 발췌

모두투어 상품 상세 페이지에서 일정·이미지·기본 정보를 DOM으로 추출하는 Chrome Extension의 content script와 관련 라이브러리 코드 발췌.

- **위치**: `tools/modetour-extractor-extension/`
- **목적**: 상품 초안 생성용 — 일정(itinerary), 이미지(media), 기본 정보(product)만 수집. 설명/포함·불포함/예약·환불 규정은 수집하지 않음.

---

## 1. Manifest — content_scripts

**파일**: `tools/modetour-extractor-extension/.plasmo/chrome-mv3.plasmo.manifest.json`

```json
"content_scripts": [
  {
    "matches": ["https://www.modetour.com/package/*"],
    "js": ["..\\src\\contents\\modetour.ts"],
    "run_at": "document_idle"
  }
],
"host_permissions": ["https://www.modetour.com/*"]
```

- `document_idle` 에서 실행.
- 팝업에서 `chrome.tabs.sendMessage(tab.id, { type: "extract" })` 로 content script에 추출 요청.

---

## 2. Content Script 진입점 — 메시지 리스너 및 추출 오케스트레이션

**파일**: `tools/modetour-extractor-extension/src/contents/modetour.ts`

```typescript
/**
 * 모두투어 상품 상세 페이지 Content Script.
 * PR16/PR17: 상품 초안 생성용으로만 동작 — 일정(itinerary), 이미지(media), 기본 정보(product)만 수집합니다.
 */
import type { PlasmoCSConfig } from "plasmo";
import type { ExtractedDomData, ExtractMeta } from "~lib/extractTypes";
import { waitForPageLoad, waitForSelector, sleep } from "~lib/domWait";
import { getJsonLdObjects, pickBestJsonLd, mapJsonLdToImport } from "~lib/jsonLd";
import { getScopedSection } from "~lib/sectionScope";
import { parseItineraryText } from "~lib/itineraryParser";
import { extractItineraryFromDom } from "~lib/itineraryDom";
import {
  extractImageUrlsFromDom,
  extractImageUrlsFromNode,
  pickHeroImage,
  assignItineraryImagesToDays,
  normalizeImageUrl,
  normalizedKeyForDedupe,
  filterUsefulImageUrls,
} from "~lib/images";
import {
  SELECTORS,
  queryFirst,
  queryText,
  getImageUrl,
  truncateSnippet,
} from "~lib/selectors";
import { parseNightsDays, parseDayPatternsFromText } from "~lib/parseText";
import { prepareItineraryUi } from "~lib/modetourUiPrep";

export const config: PlasmoCSConfig = {
  matches: ["https://www.modetour.com/package/*"],
  run_at: "document_idle",
};

const SNIPPET_MAX = 5000;
const RAW_DOM_HINT_MAX = 800;

async function extractFromDom(): Promise<{ extracted: ExtractedDomData; meta: ExtractMeta }> {
  await waitForPageLoad();
  await waitForSelector("h1", 8000, 200);
  await sleep(500);

  const uiPrep = await prepareItineraryUi();
  await sleep(300);

  const doc = document;
  const missingSections: string[] = [];
  let usedJsonLd = false;
  let usedItineraryText = false;
  let itinerarySource: "DOM" | "TEXT" | "RAW" = "RAW";
  // ... (일정: DOM → 텍스트 파서 → raw 스니펫 순으로 폴백)
  // ... (제목/가격/메타: JSON-LD → SELECTORS → h1/title 폴백)
  // ... (이미지: hero + gallery 대표 + unassigned 수집)

  return {
    extracted: { source, product, itinerary, media, rawSnippets, missingSections },
    meta: { usedJsonLd, usedItineraryText, itinerarySource, ... },
  };
}

chrome.runtime.onMessage.addListener(
  (msg: { type: string }, _sender, sendResponse: (r: { extracted: ExtractedDomData; meta: ExtractMeta }) => void) => {
    if (msg.type === "extract") {
      extractFromDom()
        .then(({ extracted, meta }) => sendResponse({ extracted, meta }))
        .catch((e) => {
          sendResponse({
            extracted: {
              source: { url: location.href, fetchedAtISO: new Date().toISOString() },
              product: { title: "" },
              missingSections: ["EXTRACT_ERROR"],
              rawSnippets: { itinerary: String(e) },
            },
            meta: { usedJsonLd: false, usedItineraryText: false },
          });
        });
    }
    return true;
  },
);
```

- **흐름**: `waitForPageLoad` → `waitForSelector("h1")` → `prepareItineraryUi()`(일정 탭 클릭·아코디언 펼침) → JSON-LD·섹션 스코프·DOM 일정·이미지 수집 → `ExtractedDomData` + `ExtractMeta` 반환.
- **일정**: `extractItineraryFromDom(doc)` 성공 시 DOM 결과 사용, 실패/이벤트 부족 시 `parseItineraryText(sectionItineraryText)` 또는 `parseDayPatternsFromText` 로 텍스트 폴백.

---

## 3. 추출 데이터 타입

**파일**: `tools/modetour-extractor-extension/src/lib/extractTypes.ts`

```typescript
export type ExtractedDomData = {
  source: { url: string; fetchedAtISO: string };
  product: {
    title: string;
    summary?: string;
    nights?: number;
    days?: number;
    regionText?: string;
    priceText?: string;
  };
  itinerary?: {
    days: Array<{
      dayNumber: number;
      title?: string;
      dateText?: string;
      descriptionText?: string;
      imageUrls?: string[];
      events: Array<{
        order: number;
        timeText?: string;
        title?: string;
        typeText?: string;
        descriptionText?: string;
        imageUrls?: string[];
      }>;
    }>;
  };
  inclusions?: { ... };
  terms?: { ... };
  detailTabs?: { ... };
  media?: {
    heroImageUrl?: string;
    galleryImageUrls: string[];
    unassignedImageUrls: string[];
  };
  rawSnippets?: { itinerary?: string; itineraryDomHint?: string; ... };
  missingSections?: string[];
};

export type ExtractMeta = {
  usedJsonLd: boolean;
  usedItineraryText: boolean;
  itinerarySource?: "DOM" | "TEXT" | "RAW";
  itineraryDomDebug?: { dayHeaderCount; dayContainerCount; eventCount; ... };
  itineraryScopeFound?: boolean;
  itineraryTextLength?: number;
  imageCounts?: { hero: number; gallery: number; itinerary: number };
  imagesLowConfidence?: boolean;
  uiPrep?: { didClickTab: boolean; expandedCount: number; debug?: { ... } };
};
```

---

## 4. DOM 대기 유틸 (크롤링 전 준비)

**파일**: `tools/modetour-extractor-extension/src/lib/domWait.ts`

```typescript
export function waitForPageLoad(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const onLoad = () => {
      window.removeEventListener("load", onLoad);
      resolve();
    };
    window.addEventListener("load", onLoad);
  });
}

export function waitForSelector(
  selector: string,
  timeoutMs = 8000,
  intervalMs = 200,
): Promise<boolean> {
  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;
    const tick = () => {
      try {
        const el = document.querySelector(selector);
        if (el) { resolve(true); return; }
      } catch {}
      if (Date.now() >= deadline) { resolve(false); return; }
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

---

## 5. DOM 셀렉터 및 헬퍼

**파일**: `tools/modetour-extractor-extension/src/lib/selectors.ts`

```typescript
export const SELECTORS = {
  title: ["h1.pkg-title", "h1.title", ".product-title h1", ".pkg-detail-title", "[class*='productName']", "[class*='packageTitle']", "h1"],
  summary: [".pkg-summary", ".product-summary", "[class*='summary']", ".subtitle"],
  price: [".price-wrap", ".pkg-price", "[class*='price']", ".product-price"],
  meta: [".pkg-info", ".product-meta", "[class*='nights']", "[class*='duration']", ".info-tags"],
  itineraryRoot: ["#itinerary", ".itinerary", ".pkg-itinerary", "[class*='itinerary']", ".schedule-detail", ".day-schedule"],
  daySection: ["[class*='day']", ".day-item", ".schedule-day", "section[class*='day']"],
  inclusions: ["#inclusion", ".inclusion", "[class*='inclusion']", "[class*='포함']"],
  exclusions: ["[class*='exclusion']", "[class*='불포함']"],
  terms: ["#terms", ".terms", "[class*='terms']", "[class*='약관']", "[class*='취소']", "[class*='유의사항']"],
  heroImage: [".pkg-hero img", ".hero-image img", ".main-image img", "[class*='hero'] img", ".gallery-main img", ".swiper-slide-active img", ".detail-gallery img"],
  galleryImages: [".pkg-gallery img", ".gallery-list img", "[class*='gallery'] img", ".thumb-list img", ".detail-images img"],
} as const;

export function queryFirst(doc: Document, selectors: readonly string[]): Element | null {
  for (const sel of selectors) {
    try {
      const el = doc.querySelector(sel);
      if (el) return el;
    } catch { continue; }
  }
  return null;
}

export function queryText(doc: Document, selectors: readonly string[]): string | null {
  const el = queryFirst(doc, selectors);
  if (!el) return null;
  const text = el.textContent?.trim() ?? "";
  return text || null;
}

export function getImageUrl(img: HTMLImageElement): string | null {
  const u = img.getAttribute("src") || img.getAttribute("data-src") || img.getAttribute("data-original");
  if (u?.trim()) return u.trim();
  const srcset = img.getAttribute("srcset");
  if (srcset?.trim()) {
    const first = srcset.split(",")[0]?.trim().split(/\s+/)[0];
    if (first) return first;
  }
  return null;
}

export function truncateSnippet(text: string, maxLen: number = 5000): string {
  const t = text.trim();
  if (t.length <= maxLen) return t;
  return t.slice(0, maxLen) + "\n…(truncated)";
}
```

---

## 6. 섹션 스코프 (일정 텍스트 구간 자르기)

**파일**: `tools/modetour-extractor-extension/src/lib/sectionScope.ts`

- 헤딩 키워드(예: "일정", "여행일정", "상세일정")로 첫 헤딩 노드 탐색.
- 해당 헤딩이 속한 섹션 컨테이너를 찾고, "헤딩 ~ 다음 동급/상위 헤딩 앞" 구간만 텍스트로 잘라 반환.

```typescript
const HEADING_SELECTORS = "h1, h2, h3, h4, h5, h6, strong, [role='tab'], button, [class*='title'], [class*='heading']";

export function findHeadingNode(keywords: string[]): Element | null;
export function getSectionContainer(headingNode: Element): Element;
export function clampSectionByNextHeading(container: Element, headingNode: Element): string;

export type ScopedSectionResult = {
  container: Element | null;
  text: string;
  node: Element | null;
  warning?: string;
};

export function getScopedSection(keywords: string[], maxLen = 5000): ScopedSectionResult {
  // keywords로 헤딩 찾기 → 섹션 컨테이너 구하기 → 헤딩~다음 헤딩 앞까지만 텍스트 추출.
  // text.length < 100 이면 warning: "ITINERARY_SCOPE_TOO_SHORT"
  // 헤딩 없으면 warning: "ITINERARY_SCOPE_NOT_FOUND"
}
```

---

## 7. DOM 기반 일정 크롤링 — Day 컨테이너·이벤트 블록

**파일**: `tools/modetour-extractor-extension/src/lib/itineraryDom.ts`

- **Day 헤더**: `(\d{1,2})일차` 정규로 h1~h6, strong, div, span, button, a, `[class*='day']` 등에서 탐색.
- **Day 컨테이너**: 각 헤더 엘리먼트에서 위로 올라가며 `MIN_DAY_CONTAINER_TEXT`(200) 이상 텍스트를 가진 div/section/article 등 후보 중, 다음 Day 헤더를 포함하지 않고 헤더가 1개만 포함된 블록을 점수로 선정.
- **이벤트**:
  - **타임라인**: `div[class*="flex"][class*="items-stretch"][class*="space-x-[6px]"]` 등으로 블록 찾고, 제목(`text-[17px] font-semibold`), 설명(`div[id^="content"]`), 이미지(`.swiper-thumbs img`) 추출.
  - **카드**: `div[class*="rounded-[10px]"][class*="py-"][class*="px-"][class*="border"]` 등에서 제목/설명 추출.
- **타입 추론**: `inferTimelineTypeText` / `inferCardTypeText` — "유의|안내|수속" → notice, "출발|도착|항공" → flight, "예정호텔|호텔" → hotel, "식사|조식|중식|석식" → meal, 그 외 activity / info.

```typescript
const DAY_HEADER_REGEX = /(^|\s)(\d{1,2})일차(\s|$)/;
const DAY_HEADER_FULL = /(\d{1,2})일차\s*(.*)/;
const MAX_DESCRIPTION_LEN = 2000;
const MAX_IMAGES_PER_EVENT = 8;
const MIN_DAY_CONTAINER_TEXT = 200;
const MAX_DAY_CONTAINER_TEXT = 5000;

function getDayHeaderElements(root: Document): DayHeaderInfo[];
function findDayContainer(headerEl, nextHeaderEl, headers, root): Element | null;
function getTimelineItems(dayContainer: Element): Element[];
function getTimelineContentRoot(item: Element): Element | null;
function getTimelineTitle(contentRoot: Element): string;
function getTimelineDescription(contentRoot: Element): string;
function getSwiperThumbUrls(contentRoot: Element): string[];
function getCardItems(dayContainer: Element): Element[];
function extractEventsInOrder(dayContainer, dayHeaderEl): { events; timelineItemCount; cardCount; acceptedCount };

export type DomItineraryResult = {
  days: ModetourImportV1["itinerary"]["days"];
  warnings: ModetourImportWarning[];
  debug?: { dayHeaderCount; dayContainerCount; eventCount; dayHeaderTexts; firstDayContainerTextPrefix; sampleDomPaths; ... };
};

export function extractItineraryFromDom(root: Document): DomItineraryResult;
```

---

## 8. 추출 전 UI 준비 (일정 탭·아코디언 펼침)

**파일**: `tools/modetour-extractor-extension/src/lib/modetourUiPrep.ts`

- **일정 탭**: `[role="tab"]`, `button`, `a[role="button"]` 중 텍스트에 "일정", "여행일정", "상세일정" 포함된 첫 요소 클릭.
- **일정 DOM 대기**: `document.body.innerText`에 "일차"가 나올 때까지 최대 2초 폴링.
- **아코디언**: `aria-expanded="false"` 이면서 주변에 "일차"가 있는 버튼을 찾아 최대 20개 클릭 (150ms 간격).
- **expandedCount**: 실제로는 "n일차" 텍스트를 가진 Day 헤더/블록 개수로 반환.

```typescript
const TAB_KEYWORDS = ["일정", "여행일정", "상세일정"];
const ACCORDION_MAX_CLICKS = 20;
const ACCORDION_CLICK_INTERVAL_MS = 150;

export async function prepareItineraryUi(): Promise<PrepareItineraryUiResult> {
  // 탭 클릭 → waitForItineraryDom() → aria-expanded=false 버튼 클릭 → countDayContainers()
  return { didClickTab, expandedCount, debug: { tabText, expandedButtonCount, firstDayHeaderTexts } };
}
```

---

## 9. 이미지 수집 (발췌)

**파일**: `tools/modetour-extractor-extension/src/lib/images.ts`

- **절대 URL**: `toAbsoluteImageUrl(url, base)` — 상대 경로를 base 기준으로 변환.
- **제외**: `.svg`/`.gif`/`.ico`, icon/logo/sprite/banner/ad 등 키워드, `img.modetour.com/air/logo/`, 작은 크기(w=16|24|32), 트래킹 URL. `img.modetour.com/eagle/photoimg/` 는 로고 필터 통과.
- **정규화**: `normalizeImageUrl` / `normalizeModetourImageUrl` — resize, w, h, cache, utm 등 제거 후 중복 제거용 키 생성.
- **Hero**: JSON-LD `heroImageUrl` → 페이지에서 추출한 이미지 중 대표 → 첫 활동 첫 이미지 순 폴백.
- **Gallery**: 일정 이벤트당 첫 이미지로 대표 수집 후, 부족하면 `filterUsefulImageUrls(allImageUrls)` 로 보충.
- **Unassigned**: 페이지 내 `img[src], img[data-src], img[data-original]` 중 아직 할당되지 않은 URL만 필터 후 최대 30개.

```typescript
export function toAbsoluteImageUrl(url: string, base: string): string;
export function normalizeImageUrl(url: string): string;
export function normalizeModetourImageUrl(url: string): string;
export function isAirlineLogoUrl(url: string): boolean;
export function extractImageUrlsFromDom(): string[];
export function extractImageUrlsFromNode(node: Element): string[];
export function extractImageUrlsFromNodeWithSizeFilter(node: Element, minW: number, minH: number): string[];
export function pickHeroImage(allUrls: string[], jsonLdHero?: string, firstActivityFirst?: string): string | undefined;
export function assignItineraryImagesToDays(urls: string[], dayCount: number): string[][];
export function normalizedKeyForDedupe(url: string): string;
export function filterUsefulImageUrls(urls: string[]): string[];
```

---

## 10. 팝업에서 추출 트리거

**파일**: `tools/modetour-extractor-extension/src/popup.tsx`

- 활성 탭이 `modetour.com/package/` 인지 확인 후 `chrome.tabs.sendMessage(tab.id, { type: "extract" })` 호출.
- content script 미로드 시 `chrome.scripting.executeScript` 로 manifest의 content script JS 주입 후 400ms 대기, 다시 `sendMessage` 시도.
- 응답의 `extracted` 를 `buildModetourImportV1(extracted)` 로 변환 후 상태에 저장·클립보드 복사 등.

```typescript
const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
if (!isModetourPackageUrl(tab.url)) { setError("이 페이지는 모두투어 상품 페이지가 아닙니다."); return; }
let response;
try {
  response = await chrome.tabs.sendMessage(tab.id, { type: "extract" });
} catch (e) {
  // Content script 미로드 → 수동 주입 후 재시도
  const js = manifest.content_scripts?.[0]?.js?.[0];
  if (js) {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: [js] });
    await new Promise((r) => setTimeout(r, 400));
    response = await chrome.tabs.sendMessage(tab.id, { type: "extract" });
  }
}
const { extracted, meta } = response;
const built = buildModetourImportV1(extracted);
```

---

## 파일 목록 요약

| 경로 | 역할 |
|------|------|
| `src/contents/modetour.ts` | Content script 진입점, `extractFromDom()` 오케스트레이션, `chrome.runtime.onMessage` ("extract") |
| `src/lib/extractTypes.ts` | `ExtractedDomData`, `ExtractMeta` 타입 |
| `src/lib/domWait.ts` | `waitForPageLoad`, `waitForSelector`, `sleep` |
| `src/lib/selectors.ts` | `SELECTORS`, `queryFirst`, `queryText`, `getImageUrl`, `truncateSnippet` |
| `src/lib/sectionScope.ts` | `getScopedSection`, 일정 섹션 텍스트 구간 자르기 |
| `src/lib/itineraryDom.ts` | **DOM 일정 크롤링** — Day 헤더/컨테이너/타임라인·카드 이벤트 추출 |
| `src/lib/itineraryParser.ts` | 텍스트 일정 파싱 (DOM 실패 시 폴백) |
| `src/lib/modetourUiPrep.ts` | 일정 탭 클릭, 아코디언 펼침, 일정 DOM 대기 |
| `src/lib/images.ts` | 이미지 URL 추출·정규화·hero/gallery/unassigned 수집 |
| `src/lib/jsonLd.ts` | JSON-LD 수집·선택·import 형식 매핑 |
| `src/lib/buildImport.ts` | `ExtractedDomData` → `ModetourImportV1` 변환 |
| `src/popup.tsx` | 팝업 UI, 추출 요청·결과 표시·클립보드 복사 |

위 파일들이 현재 크롬 익스텐션의 content script 및 크롤링 함수를 구성합니다.
