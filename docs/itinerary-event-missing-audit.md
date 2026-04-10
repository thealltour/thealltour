# 상세일정 이벤트 누락 원인 분석용 코드 발췌

**생성 목적**: 사진 없는 이벤트(출발/도착/이동 등) 누락과 DOM 채택 규칙 분석.
**주의**: 아래 코드는 저장소 원문 전체이며, 요약·생략 없음.

---

## `tools/modetour-extractor-extension/src/lib/itineraryDom.ts`

* 역할: DOM 일정 추출의 핵심. Day 헤더 탐색(getDayHeaderElements), Day 컨테이너(findDayContainer), 타임라인/카드 이벤트(extractEventsInOrder 및 getTimeline*, getCard*), 타임라인 블록 채택 조건(MIN_DESCRIPTION_FOR_ACCEPT + 이미지) 담당.

```ts
/**
 * DOM 기반 일정 추출: Day 컨테이너 단위로 분리, 이벤트 블록에서 title/description/imageUrls 추출.
 */

import type { ModetourImportV1, ModetourImportWarning } from "~types/modetourImport";
import {
  collectAllImageUrlsInScope,
  extractItineraryImageUrlsFromNode,
  getFirstImageUrlInContainer,
  scoreImageCandidate,
} from "~lib/images";

const DAY_HEADER_REGEX = /(^|\s)(\d{1,2})일차(\s|$)/;
const DAY_HEADER_FULL = /(\d{1,2})일차\s*(.*)/;
const DATE_LIKE = /(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}(?:\([^)]*\))?)/;
const MAX_DESCRIPTION_LEN = 2000;
const MAX_IMAGES_PER_EVENT = 20;
const MIN_DAY_CONTAINER_TEXT = 200;
const MAX_DAY_CONTAINER_TEXT = 5000;
const MAX_DAY_HEADER_TEXT_LEN = 120;
const RAW_DOM_HINT_MAX = 800;
const MIN_DESCRIPTION_FOR_ACCEPT = 10;

function getTimelineItems(dayContainer: Element): Element[] {
  const out: Element[] = [];
  const candidates = dayContainer.querySelectorAll('div[class*="flex"][class*="items-stretch"][class*="justify-start"]');
  for (const el of candidates) {
    const cls = (el.className && typeof el.className === "string" ? el.className : "") || "";
    if (cls.includes("space-x-[12px]")) continue;
    if (!cls.includes("space-x-[6px]")) continue;
    if (((el as HTMLElement).textContent?.trim().length ?? 0) < 20) continue;
    out.push(el);
  }
  return out;
}

function getTimelineContentRoot(item: Element): Element | null {
  const exact = item.querySelector('div[class*="w-[calc(100%_-_24px)]"]');
  if (exact) return exact;
  return item.querySelector('div[class*="calc(100%"][class*="24px"]');
}

function getTimelineTitle(contentRoot: Element): string {
  const titleWrap = contentRoot.querySelector('div[class*="text-[17px]"][class*="font-semibold"]');
  if (!titleWrap) return "";
  const inner = titleWrap.querySelector("div");
  return ((inner ?? titleWrap).textContent?.trim() ?? "").slice(0, 300) || "";
}

function getTimelineDescription(contentRoot: Element): string {
  const descEl = contentRoot.querySelector('div[id^="content"]');
  if (!descEl) return "";
  const raw = (descEl as HTMLElement).innerText ?? (descEl as HTMLElement).textContent ?? "";
  let text = raw.trim().replace(/\s+/g, " ");
  return text.length > MAX_DESCRIPTION_LEN ? text.slice(0, MAX_DESCRIPTION_LEN) + "…" : text;
}

/**
 * 이벤트 scope 내 이미지 수집 (PR-IMAGE-2: 동일 노드 내 대표 URL은 extract 경로에서 이미 정리됨 → 점수순 상한).
 */
function getEventImageCandidates(contentRoot: Element, base: string): string[] {
  const list = extractItineraryImageUrlsFromNode(contentRoot, base);
  return [...list].sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a)).slice(0, MAX_IMAGES_PER_EVENT);
}

function inferTimelineTypeText(title: string): string {
  if (/유의|안내|수속/.test(title)) return "notice";
  if (/출발|도착|공항|항공/.test(title)) return "flight";
  return "activity";
}

function getCardItems(dayContainer: Element): Element[] {
  const out: Element[] = [];
  const candidates = dayContainer.querySelectorAll('div[class*="py-"][class*="px-"][class*="border"][class*="rounded"]');
  for (const el of candidates) {
    const cls = (el.className && typeof el.className === "string" ? el.className : "") || "";
    if (!cls.includes("rounded-[10px]")) continue;
    out.push(el);
  }
  return out;
}

function getCardTitle(card: Element): string {
  const titleEl = card.querySelector('div[class*="text-[15px]"][class*="font-semibold"]');
  return titleEl?.textContent?.trim()?.slice(0, 300) ?? "";
}

function getCardDescription(card: Element): string {
  const descEl = card.querySelector('div[class*="text-[13px]"]');
  return (descEl as HTMLElement)?.innerText?.trim() ?? "";
}

function inferCardTypeText(title: string, description: string): string {
  if (title === "예정호텔" || /호텔/.test(description)) return "hotel";
  if (title === "식사" || /조식|중식|석식/.test(description)) return "meal";
  return "info";
}

function extractEventsInOrder(
  dayContainer: Element,
  dayHeaderEl: Element,
): {
  events: NonNullable<ModetourImportV1["itinerary"]>["days"][number]["events"];
  timelineItemCount: number;
  cardCount: number;
  acceptedCount: number;
} {
  const timelineItems = getTimelineItems(dayContainer);
  const cardItems = getCardItems(dayContainer);
  const allNodes: { el: Element; type: "timeline" | "card" }[] = [];
  timelineItems.forEach((el) => {
    if (!dayHeaderEl.contains(el)) allNodes.push({ el, type: "timeline" });
  });
  cardItems.forEach((el) => {
    if (!dayHeaderEl.contains(el)) allNodes.push({ el, type: "card" });
  });
  allNodes.sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));

  const seenTitles = new Set<string>();
  const events: NonNullable<ModetourImportV1["itinerary"]>["days"][number]["events"] = [];
  let order = 0;

  for (const { el, type } of allNodes) {
    if (type === "timeline") {
      const contentRoot = getTimelineContentRoot(el);
      if (!contentRoot) continue;
      const title = getTimelineTitle(contentRoot);
      if (!title) continue;
      const descriptionText = getTimelineDescription(contentRoot);
      const base = (contentRoot.ownerDocument?.defaultView as Window | undefined)?.location?.href ?? "https://www.modetour.com/";
      let imageUrls = getEventImageCandidates(contentRoot, base);
      if (imageUrls.length === 0) {
        const firstUrl = getFirstImageUrlInContainer(contentRoot, base);
        if (firstUrl) imageUrls = [firstUrl];
      }
      if (descriptionText.length <= MIN_DESCRIPTION_FOR_ACCEPT && imageUrls.length === 0) continue;
      order += 1;
      const combined = imageUrls.slice(0, MAX_IMAGES_PER_EVENT);
      const timeMatch = (contentRoot as HTMLElement).textContent?.match(/\b([01]?\d|2[0-3]):[0-5]\d\b/);
      events.push({
        order,
        timeText: timeMatch ? timeMatch[0] : undefined,
        title: title || undefined,
        typeText: inferTimelineTypeText(title),
        descriptionText: descriptionText || undefined,
        imageUrls: combined.length > 0 ? combined : undefined,
      });
    } else {
      const title = getCardTitle(el);
      if (!title) continue;
      const descriptionText = getCardDescription(el);
      if (seenTitles.has(title)) {
        const existing = events.find((e) => e.title === title);
        if (existing && descriptionText) existing.descriptionText = (existing.descriptionText ?? "") + "\n" + descriptionText;
        continue;
      }
      seenTitles.add(title);
      order += 1;
      const base = (el.ownerDocument?.defaultView as Window | undefined)?.location?.href ?? "https://www.modetour.com/";
      const cardImageUrl = getFirstImageUrlInContainer(el, base);
      events.push({
        order,
        title: title || undefined,
        typeText: inferCardTypeText(title, descriptionText),
        descriptionText: descriptionText || undefined,
        imageUrls: cardImageUrl ? [cardImageUrl] : undefined,
      });
    }
  }
  return { events, timelineItemCount: timelineItems.length, cardCount: cardItems.length, acceptedCount: events.length };
}

type DayHeaderInfo = { el: Element; dayNumber: number; dateText?: string; titleText?: string };

function getDayHeaderElements(root: Document): DayHeaderInfo[] {
  const candidates = root.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, strong, div, span, button, a, [class*='day'], [class*='Day'], [class*='title'], [class*='heading']",
  );
  const result: DayHeaderInfo[] = [];
  const seen = new Set<number>();

  for (const el of candidates) {
    const text = (el as HTMLElement).textContent?.trim() ?? "";
    if (text.length > MAX_DAY_HEADER_TEXT_LEN) continue;
    const m = text.match(DAY_HEADER_REGEX);
    if (!m) continue;
    const dayNum = parseInt(m[2], 10);
    if (!Number.isFinite(dayNum) || dayNum < 1 || dayNum > 31 || seen.has(dayNum)) continue;
    seen.add(dayNum);
    const fullMatch = text.match(DAY_HEADER_FULL);
    const rest = fullMatch?.[2]?.trim() ?? "";
    const dateMatch = rest.match(DATE_LIKE);
    result.push({
      el,
      dayNumber: dayNum,
      dateText: dateMatch ? dateMatch[1] : undefined,
      titleText: rest.replace(DATE_LIKE, "").replace(/\s*[→\-–]\s*.*$/, "").trim() || undefined,
    });
  }

  result.sort((a, b) => {
    return (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
  });
  return result;
}

function countDayHeadersInside(container: Element, headers: DayHeaderInfo[]): number {
  let n = 0;
  for (const h of headers) {
    if (container.contains(h.el)) n++;
  }
  return n;
}

function findDayContainer(headerEl: Element, nextHeaderEl: Element | null, headers: DayHeaderInfo[], root: Document): Element | null {
  let best: Element | null = null;
  let bestScore = -1e9;

  let current: Element | null = headerEl.parentElement;
  while (current && current !== root.body) {
    const text = (current as HTMLElement).textContent?.trim() ?? "";
    if (text.length < MIN_DAY_CONTAINER_TEXT) {
      current = current.parentElement;
      continue;
    }
    if (nextHeaderEl && current.contains(nextHeaderEl)) {
      current = current.parentElement;
      continue;
    }

    const tag = current.tagName.toLowerCase();
    if (tag !== "div" && tag !== "section" && tag !== "article" && tag !== "li" && tag !== "main") {
      current = current.parentElement;
      continue;
    }

    const headerCount = countDayHeadersInside(current, headers);
    if (headerCount >= 2) {
      current = current.parentElement;
      continue;
    }

    let score = 0;
    if (text.length >= MIN_DAY_CONTAINER_TEXT && text.length <= MAX_DAY_CONTAINER_TEXT) {
      score += 100;
    }
    const imgCount = current.querySelectorAll("img").length;
    const cardLike = current.querySelectorAll("[class*='card'], [class*='item'], [class*='block']").length;
    score += Math.min(imgCount * 5, 50) + Math.min(cardLike * 3, 30);

    if (score > bestScore) {
      bestScore = score;
      best = current;
    }
    current = current.parentElement;
  }

  return best;
}

function inferEventType(title: string, description: string): string {
  const combined = `${title} ${description}`.toLowerCase();
  if (/예정\s*호텔|호텔\s*예정|숙소/.test(combined)) return "hotel";
  if (/식사|조식|중식|석식|디너|런치/.test(combined)) return "meal";
  if (/출발|도착|항공|비행|기차|이동/.test(combined)) return "flight";
  if (/유의|안내\s*사항|참고/.test(combined)) return "notice";
  return "activity";
}

export type DomItineraryResult = {
  days: NonNullable<ModetourImportV1["itinerary"]>["days"];
  warnings: ModetourImportWarning[];
  debug?: {
    dayHeaderCount: number;
    dayContainerCount: number;
    eventCount: number;
    eventItemCount?: number;
    eventAcceptedCount?: number;
    timelineItemCount?: number;
    cardCount?: number;
    eventCountByDay?: number[];
    dayHeaderTexts?: string[];
    firstDayContainerTextPrefix?: string;
    sampleDomPaths?: string[];
  };
};

/**
 * DOM에서 일정 추출: Day 헤더 → Day 컨테이너 → 이벤트 블록 → title/description/imageUrls.
 */
export function extractItineraryFromDom(root: Document): DomItineraryResult {
  const warnings: ModetourImportWarning[] = [];
  const headers = getDayHeaderElements(root);
  const debug = {
    dayHeaderCount: headers.length,
    dayContainerCount: 0,
    eventCount: 0,
    eventItemCount: 0,
    eventAcceptedCount: 0,
    timelineItemCount: 0,
    cardCount: 0,
    eventCountByDay: [] as number[],
    dayHeaderTexts: headers.slice(0, 10).map((h) => (h.el as HTMLElement).textContent?.trim()?.slice(0, 80) ?? ""),
    firstDayContainerTextPrefix: undefined as string | undefined,
    sampleDomPaths: [] as string[],
  };

  if (headers.length === 0) {
    return { days: [], warnings: [...warnings], debug };
  }

  const days: NonNullable<ModetourImportV1["itinerary"]>["days"] = [];

  for (let i = 0; i < headers.length; i++) {
    const h = headers[i];
    const nextHeader = i + 1 < headers.length ? headers[i + 1].el : null;
    const dayContainer = findDayContainer(h.el, nextHeader, headers, root);
    if (!dayContainer) continue;

    debug.dayContainerCount = days.length + 1;
    if (days.length === 0 && !debug.firstDayContainerTextPrefix) {
      const prefix = (dayContainer as HTMLElement).textContent?.trim().slice(0, RAW_DOM_HINT_MAX) ?? "";
      debug.firstDayContainerTextPrefix = prefix;
    }
    if (debug.sampleDomPaths.length < 3) {
      const path: string[] = [];
      let cur: Element | null = dayContainer;
      while (cur && cur !== root.body && path.length < 5) {
        path.push(cur.tagName.toLowerCase() + (cur.className ? "." + (cur.className.toString().split(/\s+/)[0] || "") : ""));
        cur = cur.parentElement;
      }
      debug.sampleDomPaths.push(path.reverse().join(" > "));
    }

    const dayHeaderText = (h.el as HTMLElement).textContent?.trim() ?? "";
    const { events, timelineItemCount, cardCount, acceptedCount } = extractEventsInOrder(dayContainer, h.el);
    debug.eventCount += acceptedCount;
    debug.eventItemCount = (debug.eventItemCount ?? 0) + timelineItemCount + cardCount;
    debug.eventAcceptedCount = (debug.eventAcceptedCount ?? 0) + acceptedCount;
    debug.timelineItemCount = (debug.timelineItemCount ?? 0) + timelineItemCount;
    debug.cardCount = (debug.cardCount ?? 0) + cardCount;
    debug.eventCountByDay.push(events.length);

    const base = (dayContainer.ownerDocument?.defaultView as Window | undefined)?.location?.href ?? "https://www.modetour.com/";
    const dayScopeRaw = extractItineraryImageUrlsFromNode(dayContainer, base);
    const assignedToEvents = new Set(events.flatMap((e) => e.imageUrls ?? []));
    let dayOnlyUrls = dayScopeRaw.filter((u) => !assignedToEvents.has(u)).slice(0, 15);
    if (dayOnlyUrls.length === 0) {
      const firstFromEvents = events.flatMap((e) => e.imageUrls ?? [])[0];
      const firstFromDay = getFirstImageUrlInContainer(dayContainer, base);
      const firstFromScope = dayScopeRaw[0];
      const firstDayImage = firstFromEvents ?? firstFromDay ?? firstFromScope;
      if (firstDayImage) dayOnlyUrls = [firstDayImage];
    }

    days.push({
      dayNumber: h.dayNumber,
      title: h.titleText,
      dateText: h.dateText,
      descriptionText: undefined,
      imageUrls: dayOnlyUrls.length > 0 ? dayOnlyUrls : undefined,
      events: events.length > 0 ? events : [{ order: 1, title: "(내용 없음)" }],
    });
  }

  return { days, warnings, debug };
}

```

---

## `tools/modetour-extractor-extension/src/contents/modetour.ts`

* 역할: 콘텐츠 스크립트 진입점. prepareItineraryUi 후 extractItineraryFromDom 호출, DOM 성공/실패/저이벤트 시 parseItineraryText·parseDayPatternsFromText로 보완·폴백. 일정 소스 메타(itinerarySource) 설정.

```ts
/**
 * 모두투어 상품 상세 페이지 Content Script.
 * PR16/PR17: 상품 초안 생성용으로만 동작 — 일정(itinerary), 이미지(media), 기본 정보(product)만 수집합니다.
 * 설명/포함·불포함/예약·환불 규정은 수집하지 않으며, includeExcludeDom / detailTabsDom 파서는 호출하지 않습니다.
 */
import type { PlasmoCSConfig } from "plasmo";
import type { ExtractedDomData, ExtractMeta } from "~lib/extractTypes";
import { waitForPageLoad, waitForSelector, sleep } from "~lib/domWait";
import { getJsonLdObjects, pickBestJsonLd, mapJsonLdToImport } from "~lib/jsonLd";
import { getScopedSection } from "~lib/sectionScope";
import { parseItineraryText } from "~lib/itineraryParser";
import { extractItineraryFromDom } from "~lib/itineraryDom";
import {
  collectAllImageUrlsInScope,
  collectImageUrlsRawFromDom,
  collectHeroImageUrls,
  collectPictureCandidates,
  collectPreferredImgCandidates,
  filterUsefulImageUrls,
  normalizeOpenImageUrl,
  normalizedKeyForDedupe,
  assignItineraryImagesToDays,
  selectRepresentativeUrls,
  scoreImageCandidate,
} from "~lib/images";
import {
  SELECTORS,
  queryFirst,
  queryText,
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
const IMAGE_STABILIZE_POLL_MS = 250;
const IMAGE_STABILIZE_MAX_MS = 1000;

/** 이미지 수 안정화 대기. 최대 1초 내 종료 보장 */
async function waitForImageStabilization(): Promise<void> {
  const deadline = Date.now() + IMAGE_STABILIZE_MAX_MS;
  let prevCount = -1;
  while (Date.now() < deadline) {
    await sleep(IMAGE_STABILIZE_POLL_MS);
    const n = collectImageUrlsRawFromDom(document.body).length;
    if (n === prevCount) break;
    prevCount = n;
  }
}

type ImageSource = "hero" | "itinerary" | "detail" | "fallback";

async function extractFromDom(): Promise<{ extracted: ExtractedDomData; meta: ExtractMeta }> {
  await waitForPageLoad();
  await waitForSelector("h1", 8000, 200);
  await sleep(500);

  const uiPrep = await prepareItineraryUi();
  await waitForImageStabilization();

  const doc = document;
  const baseUrl = doc.defaultView?.location?.href ?? "https://www.modetour.com/";
  const missingSections: string[] = [];
  let usedJsonLd = false;
  let usedItineraryText = false;
  let itinerarySource: "DOM" | "TEXT" | "RAW" = "RAW";
  let itineraryDomDebug: ExtractMeta["itineraryDomDebug"];
  const uiPrepResult: ExtractMeta["uiPrep"] = { didClickTab: uiPrep.didClickTab, expandedCount: uiPrep.expandedCount, debug: uiPrep.debug };

  const jsonLdObjs = getJsonLdObjects();
  const { product: productLd } = pickBestJsonLd(jsonLdObjs);
  const jsonLdPartial = mapJsonLdToImport(productLd);
  if (jsonLdPartial) usedJsonLd = true;

  const itineraryScope = getScopedSection(["일정", "여행일정", "상세일정", "일정표"], SNIPPET_MAX);
  const sectionItineraryText = itineraryScope.text ?? "";
  if (itineraryScope.warning) missingSections.push(itineraryScope.warning);

  let itinerary: ExtractedDomData["itinerary"];
  const rawSnippets: ExtractedDomData["rawSnippets"] = {};

  const domResult = extractItineraryFromDom(doc);
  const totalDomEvents = domResult.days.reduce((acc, d) => acc + (d.events?.length ?? 0), 0);
  const domSuccess = domResult.days.length >= 1 && totalDomEvents >= 1;
  const domDaysNoEvents = domResult.days.length >= 1 && totalDomEvents === 0;

  if (domSuccess) {
    let days = domResult.days;
    const lowEvents = totalDomEvents <= domResult.days.length;
    if (lowEvents) {
      missingSections.push("ITINERARY_DOM_LOW_EVENTS");
      const parsed = parseItineraryText((sectionItineraryText.trim() || doc.body?.textContent?.trim()) ?? "");
      const textDays = parsed.itinerary?.days ?? [];
      days = domResult.days.map((domDay) => {
        const eventCount = domDay.events?.length ?? 0;
        const needSupplement = eventCount <= 1 || (domDay.events?.[0]?.title === "(내용 없음)");
        if (!needSupplement) return domDay;
        const textDay = textDays.find((t) => t.dayNumber === domDay.dayNumber);
        const events = textDay?.events?.length
          ? textDay.events
          : (domDay.events?.length ? domDay.events : [{ order: 1, title: "(내용 없음)" }]);
        return { ...domDay, events };
      });
      usedItineraryText = true;
    }
    itinerary = { days };
    itinerarySource = "DOM";
    itineraryDomDebug = domResult.debug;
  } else if (domDaysNoEvents) {
    missingSections.push("ITINERARY_DOM_EVENTS_EMPTY");
    const parsed = parseItineraryText((sectionItineraryText.trim() || doc.body?.textContent?.trim()) ?? "");
    const textDays = parsed.itinerary?.days ?? [];
    const mergedDays = domResult.days.map((domDay) => {
      const textDay = textDays.find((t) => t.dayNumber === domDay.dayNumber);
      const events = (domDay.events?.length && domDay.events[0]?.title !== "(내용 없음)")
        ? domDay.events
        : (textDay?.events?.length ? textDay.events : domDay.events);
      return { ...domDay, events: events ?? [{ order: 1, title: "(내용 없음)" }] };
    });
    itinerary = { days: mergedDays };
    itinerarySource = "DOM";
    itineraryDomDebug = domResult.debug;
    usedItineraryText = true;
  } else {
    missingSections.push("ITINERARY_DOM_NOT_FOUND");
    if (domResult.debug?.dayHeaderTexts?.length || domResult.debug?.firstDayContainerTextPrefix || domResult.debug?.sampleDomPaths?.length) {
      const parts: string[] = [];
      if (domResult.debug.dayHeaderTexts?.length) {
        parts.push("Day headers: " + domResult.debug.dayHeaderTexts.join(" | "));
      }
      if (domResult.debug.firstDayContainerTextPrefix) {
        parts.push("First container: " + domResult.debug.firstDayContainerTextPrefix.slice(0, RAW_DOM_HINT_MAX));
      }
      if (domResult.debug.sampleDomPaths?.length) {
        parts.push("Sample paths: " + domResult.debug.sampleDomPaths.join("; "));
      }
      rawSnippets.itineraryDomHint = truncateSnippet(parts.join("\n"), RAW_DOM_HINT_MAX);
    }
  }

  if (!itinerary) {
    if (sectionItineraryText.trim()) {
      const parsed = parseItineraryText(sectionItineraryText);
      if (parsed.itinerary?.days?.length) {
        itinerary = parsed.itinerary;
        usedItineraryText = true;
        itinerarySource = "TEXT";
      } else {
        rawSnippets.itinerary = truncateSnippet(sectionItineraryText);
        missingSections.push("ITINERARY_PARSE_UNCERTAIN");
      }
    }
    if (!itinerary) {
      const itineraryRoot = queryFirst(doc, SELECTORS.itineraryRoot);
      const itineraryFullText = itineraryRoot
        ? (itineraryRoot.textContent?.trim() ?? "")
        : (sectionItineraryText || doc.body?.textContent?.trim()) ?? "";
      const parsed = parseDayPatternsFromText(itineraryFullText);
      if (parsed.length > 0) {
        itinerary = { days: parsed };
        itinerarySource = "TEXT";
      } else if (itineraryFullText) {
        const fromParser = parseItineraryText(itineraryFullText);
        if (fromParser.itinerary?.days?.length) {
          itinerary = fromParser.itinerary;
          usedItineraryText = true;
          itinerarySource = "TEXT";
        } else {
          rawSnippets.itinerary = truncateSnippet(itineraryFullText.slice(0, SNIPPET_MAX));
          missingSections.push("ITINERARY_PARSE_UNCERTAIN");
          itinerary = fromParser.itinerary;
        }
      } else {
        rawSnippets.itinerary = truncateSnippet(
          sectionItineraryText ||
            itineraryScope.text ||
            queryFirst(doc, SELECTORS.itineraryRoot)?.textContent?.trim() ||
            doc.body?.textContent?.slice(0, SNIPPET_MAX) ||
            "",
        );
        missingSections.push("ITINERARY_PARSE_UNCERTAIN");
      }
    }
  }

  if (itinerary?.days?.length && itineraryScope.container && itinerarySource !== "DOM") {
    const itineraryImageUrls = extractImageUrlsFromNode(itineraryScope.container);
    const perDayUrls = assignItineraryImagesToDays(itineraryImageUrls, itinerary.days.length);
    itinerary = {
      ...itinerary,
      days: itinerary.days.map((d, i) => ({
        ...d,
        imageUrls: perDayUrls[i]?.length ? perDayUrls[i] : d.imageUrls,
      })),
    };
  }

  let title =
    jsonLdPartial?.product?.title?.trim() ??
    queryText(doc, SELECTORS.title) ??
    doc.querySelector("h1")?.textContent?.trim() ??
    doc.title?.trim() ??
    "";

  const priceText = queryText(doc, SELECTORS.price) ?? undefined;
  const metaText = queryText(doc, SELECTORS.meta) ?? "";
  const { nights, days } = parseNightsDays(metaText);
  const regionText = metaText.replace(/\d+\s*박\s*\d+\s*일/g, "").trim() || undefined;

  const firstActivityFirstImage = (() => {
    const dayList = itinerary?.days ?? [];
    const pool: string[] = [];
    for (const d of dayList) {
      const ev = d.events?.find((e) => e.typeText === "activity");
      if (ev?.imageUrls?.length) pool.push(...ev.imageUrls);
      if (pool.length) break;
    }
    if (pool.length === 0) return undefined;
    return [...pool].sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a))[0];
  })();
  const jsonLdHero = jsonLdPartial?.media?.heroImageUrl;

  const imageDebug: NonNullable<ExtractMeta["imageDebug"]> = {
    totalFound: 0,
    totalAfterFilter: 0,
    totalValidated: 0,
    excludedDataUri: 0,
    excludedSvg: 0,
    excludedTracking: 0,
    excludedStaticUi: 0,
    excludedPolicy: 0,
    excludedThumbnail: 0,
    excludedDuplicate: 0,
    failedToLoad: 0,
    pickedFromHero: 0,
    pickedFromItinerary: 0,
    pickedFromDetail: 0,
    pickedFromFallback: 0,
  };

  let media: ExtractedDomData["media"];
  let imagesLowConfidence = true;
  const eventImageTotal =
    itinerary?.days?.reduce(
      (acc, d) =>
        acc + (d.events?.reduce((eacc, e) => eacc + (e.imageUrls?.length ?? 0), 0) ?? 0),
      0,
    ) ?? 0;
  const itineraryImageCount =
    (itinerary?.days?.reduce(
      (acc, d) =>
        acc + (d.imageUrls?.length ?? 0) + (d.events?.reduce((eacc, e) => eacc + (e.imageUrls?.length ?? 0), 0) ?? 0),
      0,
    ) ?? 0);

  try {
    const heroRoot =
      queryFirst(doc, SELECTORS.heroGalleryRoot) ??
      queryFirst(doc, SELECTORS.heroImage)?.closest("div, section") ??
      queryFirst(doc, SELECTORS.galleryImages)?.closest("div, section") ??
      null;
    const itineraryImageRoot = queryFirst(doc, SELECTORS.itineraryRoot) ?? itineraryScope.container ?? null;
    const detailRoot = queryFirst(doc, SELECTORS.detailContent);

    const heroRawUrls = heroRoot ? collectAllImageUrlsInScope(heroRoot, baseUrl) : [];
    const itineraryRawUrls = itineraryImageRoot ? collectAllImageUrlsInScope(itineraryImageRoot, baseUrl) : [];
    const detailRawUrls = detailRoot ? collectAllImageUrlsInScope(detailRoot, baseUrl) : [];
    const fallbackRawUrls = collectImageUrlsRawFromDom(document.body);

    imageDebug.heroRawFound = heroRawUrls.length;
    imageDebug.itineraryRawFound = itineraryRawUrls.length;
    imageDebug.fallbackRawFound = fallbackRawUrls.length;

    /* itineraryRawUrls 는 이미 collectAllImageUrlsInScope 에서 정규화·중복 제거됨 */
    const itineraryFilteredUrls = itineraryRawUrls;
    imageDebug.itineraryAfterFilter = itineraryFilteredUrls.length;

    const heroRaw: Array<{ url: string; source: ImageSource }> = heroRawUrls.map((u) => ({ url: u, source: "hero" }));
    const detailRaw: Array<{ url: string; source: ImageSource }> = detailRawUrls.map((u) => ({ url: u, source: "detail" }));
    const fallbackRaw: Array<{ url: string; source: ImageSource }> = fallbackRawUrls.map((u) => ({ url: u, source: "fallback" }));

    const prioritized: Array<{ url: string; source: ImageSource }> = [];
    const seenUrl = new Set<string>();
    for (const item of [...heroRaw, ...detailRaw, ...fallbackRaw]) {
      if (seenUrl.has(item.url)) continue;
      seenUrl.add(item.url);
      prioritized.push(item);
    }

    const filteredUrls = filterUsefulImageUrls(prioritized.map((x) => x.url), baseUrl, imageDebug);
    const sourceByUrl = new Map<string, ImageSource>();
    for (const { url, source } of prioritized) {
      if (!sourceByUrl.has(url)) sourceByUrl.set(url, source);
    }

    // Hero: JSON-LD → hero 영역 picture/source·고해상도 → 동일 영역 단독 img → 일정 activity 최고점 → filteredUrls
    let heroImageUrl: string | undefined;

    const heroPictureUrls: string[] = [];
    const heroStandaloneImgUrls: string[] = [];
    if (heroRoot) {
      heroRoot.querySelectorAll("picture").forEach((p) => {
        heroPictureUrls.push(...collectPictureCandidates(p as HTMLPictureElement, baseUrl));
      });
      heroRoot.querySelectorAll("img").forEach((img) => {
        if (img.closest("picture")) return;
        heroStandaloneImgUrls.push(...collectPreferredImgCandidates(img as HTMLImageElement, baseUrl));
      });
    }
    const pictureTier = selectRepresentativeUrls(heroPictureUrls, false);
    pictureTier.sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));
    const imgTier = selectRepresentativeUrls(heroStandaloneImgUrls, false);
    imgTier.sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));

    const jsonAbs = jsonLdHero?.trim() ? normalizeOpenImageUrl(jsonLdHero.trim(), baseUrl) : undefined;
    const actAbs = firstActivityFirstImage?.trim()
      ? normalizeOpenImageUrl(firstActivityFirstImage.trim(), baseUrl)
      : undefined;

    for (const c of [jsonAbs, pictureTier[0], imgTier[0], actAbs].filter(Boolean) as string[]) {
      heroImageUrl = c;
      break;
    }
    if (!heroImageUrl) {
      for (const u of filteredUrls) {
        heroImageUrl = u;
        break;
      }
    }

    if (typeof console !== "undefined" && console.log) {
      console.log("[IMAGE][HERO_SELECTED]", heroImageUrl ?? null);
    }

    const heroImages =
      heroRawUrls.length > 0
        ? heroRawUrls.slice(0, 10)
        : collectHeroImageUrls(doc, baseUrl, SELECTORS.heroImage, 10);

    const dayRepImageUrls: string[] = [];
    for (const d of itinerary?.days ?? []) {
      const pool: string[] = [];
      if (d.imageUrls?.length) pool.push(...d.imageUrls);
      for (const e of d.events ?? []) {
        if (e.imageUrls?.length) pool.push(...e.imageUrls);
      }
      const rep = pool.length ? selectRepresentativeUrls(pool, false)[0] : undefined;
      if (rep) dayRepImageUrls.push(rep);
    }

    const GALLERY_REPRESENTATIVE_MAX = 50;
    const UNASSIGNED_MAX = 30;

    const galleryPool: string[] = [];
    for (const u of heroImages) galleryPool.push(u);
    for (const u of dayRepImageUrls) galleryPool.push(u);
    for (const u of itineraryFilteredUrls) galleryPool.push(u);
    for (const u of filteredUrls) galleryPool.push(u);

    const galleryMerged = selectRepresentativeUrls(galleryPool, false);

    if (typeof console !== "undefined" && console.log) {
      console.log("[IMAGE][GALLERY_PIPELINE]", {
        poolRaw: galleryPool.length,
        afterRepresentatives: galleryMerged.length,
      });
    }

    const galleryImageUrls: string[] = [];
    const heroDedupeKey = heroImageUrl ? normalizedKeyForDedupe(heroImageUrl) : null;
    if (heroImageUrl) galleryImageUrls.push(heroImageUrl);
    for (const u of galleryMerged) {
      if (galleryImageUrls.length >= GALLERY_REPRESENTATIVE_MAX) break;
      if (heroDedupeKey && normalizedKeyForDedupe(u) === heroDedupeKey) continue;
      galleryImageUrls.push(u);
    }

    const itineraryKeySet = new Set(itineraryFilteredUrls.map((u) => normalizedKeyForDedupe(u)));
    imageDebug.itineraryAssignedCount = galleryImageUrls.filter((u) =>
      itineraryKeySet.has(normalizedKeyForDedupe(u)),
    ).length;

    const galleryDedupeKeys = new Set(galleryImageUrls.map((u) => normalizedKeyForDedupe(u)));
    const unassignedPool = [...filteredUrls]
      .filter((u) => !galleryDedupeKeys.has(normalizedKeyForDedupe(u)))
      .sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));
    const unassignedTrimmed = unassignedPool.slice(0, UNASSIGNED_MAX);

    imageDebug.pickedFromHero = 0;
    imageDebug.pickedFromItinerary = 0;
    imageDebug.pickedFromDetail = 0;
    imageDebug.pickedFromFallback = 0;
    const bumpGallerySource = (u: string | undefined) => {
      if (!u) return;
      const src = sourceByUrl.get(u);
      if (src === "hero") imageDebug.pickedFromHero += 1;
      else if (src === "itinerary") imageDebug.pickedFromItinerary += 1;
      else if (src === "detail") imageDebug.pickedFromDetail += 1;
      else if (src === "fallback") imageDebug.pickedFromFallback += 1;
    };
    for (const u of galleryImageUrls) bumpGallerySource(u);
    for (const u of unassignedTrimmed) bumpGallerySource(u);

    if (typeof console !== "undefined" && console.log) {
      console.log("[IMAGE][GALLERY_COUNT]", galleryImageUrls.length);
    }

    media =
      heroImageUrl || galleryImageUrls.length > 0 || unassignedTrimmed.length > 0
        ? {
            heroImageUrl,
            galleryImageUrls,
            unassignedImageUrls: unassignedTrimmed,
          }
        : undefined;

    const totalPicked = imageDebug.pickedFromHero + imageDebug.pickedFromItinerary + imageDebug.pickedFromDetail + imageDebug.pickedFromFallback;
    const fallbackRatio = totalPicked > 0 ? imageDebug.pickedFromFallback / totalPicked : 0;
    imagesLowConfidence =
      !heroImageUrl ||
      galleryImageUrls.length < 3 ||
      fallbackRatio > 0.7;
  } catch (_imageError) {
    media = undefined;
    imagesLowConfidence = true;
  }

  console.log("[modetour-extract] imageDebug", {
    totalFound: imageDebug.totalFound,
    totalAfterFilter: imageDebug.totalAfterFilter,
    heroRawFound: imageDebug.heroRawFound,
    itineraryRawFound: imageDebug.itineraryRawFound,
    itineraryAfterFilter: imageDebug.itineraryAfterFilter,
    itineraryAssignedCount: imageDebug.itineraryAssignedCount,
    fallbackRawFound: imageDebug.fallbackRawFound,
    excludedDataUri: imageDebug.excludedDataUri,
    excludedSvg: imageDebug.excludedSvg,
    excludedTracking: imageDebug.excludedTracking,
    excludedStaticUi: imageDebug.excludedStaticUi,
    excludedPolicy: imageDebug.excludedPolicy,
    excludedThumbnail: imageDebug.excludedThumbnail,
    excludedDuplicate: imageDebug.excludedDuplicate,
    pickedFromHero: imageDebug.pickedFromHero,
    pickedFromItinerary: imageDebug.pickedFromItinerary,
    pickedFromDetail: imageDebug.pickedFromDetail,
    pickedFromFallback: imageDebug.pickedFromFallback,
  });

  if (imagesLowConfidence) missingSections.push("IMAGES_LOW_CONFIDENCE");

  return {
    extracted: {
      source: {
        url: location.href,
        fetchedAtISO: new Date().toISOString(),
      },
      product: {
        title,
        summary: undefined,
        nights,
        days,
        regionText,
        priceText,
      },
      itinerary,
      inclusions: undefined,
      terms: undefined,
      detailTabs: undefined,
      media,
      rawSnippets: Object.keys(rawSnippets).length > 0 ? rawSnippets : undefined,
      missingSections: missingSections.length > 0 ? missingSections : undefined,
    },
    meta: {
      usedJsonLd,
      usedItineraryText,
      itinerarySource,
      itineraryDomDebug,
      uiPrep: uiPrepResult,
      itineraryScopeFound: !!itineraryScope.container,
      itineraryTextLength: sectionItineraryText.length,
      imageCounts: {
        hero: media?.heroImageUrl ? 1 : 0,
        gallery: media?.galleryImageUrls?.length ?? 0,
        itinerary: itineraryImageCount,
      },
      imagesLowConfidence: imagesLowConfidence || undefined,
      imageDebug,
    },
  };
}

chrome.runtime.onMessage.addListener(
  (
    msg: { type: string },
    _sender: chrome.runtime.MessageSender,
    sendResponse: (r: { extracted: ExtractedDomData; meta: ExtractMeta }) => void,
  ) => {
    if (msg.type === "extract") {
      extractFromDom()
        .then(({ extracted, meta }) => sendResponse({ extracted, meta }))
        .catch((e) => {
          sendResponse({
            extracted: {
              source: {
                url: location.href,
                fetchedAtISO: new Date().toISOString(),
              },
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

---

## `tools/modetour-extractor-extension/src/lib/itineraryParser.ts`

* 역할: 일정 원문 텍스트에서 Day 블록 분리(splitByDayBlocks) 및 줄 단위 이벤트 후보(isEventLine/parseEventLines). DOM 보완·폴백에 사용.

```ts
/**
 * 일정(Day/이벤트) 파서 v2: 원문 기반 + 검증 강화.
 * raw itinerary 텍스트에서 Day/이벤트 추출.
 */

import type { ModetourImportV1 } from "~types/modetourImport";
import type { ModetourImportWarning } from "~types/modetourImport";

type DayBlock = {
  dayNumber: number;
  title?: string;
  dateText?: string;
  descriptionText?: string;
  events: Array<{
    order: number;
    timeText?: string;
    title?: string;
    typeText?: string;
    descriptionText?: string;
  }>;
};

const DAY_SPLIT_PATTERNS = [
  /^(?:Day)\s*(\d{1,2})\b/gm,
  /^(\d{1,2})일차\b/gm,
  /^\[\s*(\d{1,2})일차\s*\]/gm,
];

const TIME_PATTERN = /\b([01]?\d|2[0-3]):[0-5]\d\b/;
const BULLET_OR_NUMBER = /^[\s]*([•\-*]\s*|\d+\.\s*)/;
const FORBIDDEN_WORDS = /상품|약관|포함|불포함|SEO/i;
const MIN_EVENT_LINE_LEN = 4;

function splitByDayBlocks(itineraryText: string): { num: number; start: number; end: number }[] {
  const text = itineraryText.trim();
  if (!text) return [];

  let bestBlocks: { num: number; start: number; end: number }[] = [];
  for (const regex of DAY_SPLIT_PATTERNS) {
    const blocks: { num: number; start: number; end: number }[] = [];
    const re = new RegExp(regex.source, regex.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const num = parseInt(m[1], 10);
      if (Number.isFinite(num) && num >= 1 && num <= 31) {
        blocks.push({ num, start: m.index, end: m.index + m[0].length });
      }
    }
    if (blocks.length > bestBlocks.length) bestBlocks = blocks;
  }

  if (bestBlocks.length === 0) return [];

  const result: { num: number; start: number; end: number }[] = [];
  for (let i = 0; i < bestBlocks.length; i++) {
    const end =
      i + 1 < bestBlocks.length ? bestBlocks[i + 1].start : text.length;
    result.push({
      num: bestBlocks[i].num,
      start: bestBlocks[i].start,
      end,
    });
  }
  return result;
}

function isEventLine(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (TIME_PATTERN.test(t)) return true;
  if (BULLET_OR_NUMBER.test(t)) return true;
  if (t.length >= MIN_EVENT_LINE_LEN && !FORBIDDEN_WORDS.test(t)) return true;
  return false;
}

function parseEventLines(blockText: string): DayBlock["events"] {
  const lines = blockText.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const events: DayBlock["events"] = [];
  let order = 0;
  lines.forEach((line) => {
    if (!isEventLine(line)) return;
    order += 1;
    const timeMatch = line.match(TIME_PATTERN);
    const timeText = timeMatch ? timeMatch[0] : undefined;
    let title = line;
    if (timeMatch) {
      title = line.replace(TIME_PATTERN, "").replace(/^[\s\-–—:]+/, "").trim();
    }
    events.push({
      order,
      timeText,
      title: title.slice(0, 300) || undefined,
      descriptionText: title.length > 300 ? title.slice(300) : undefined,
    });
  });
  if (events.length === 0) events.push({ order: 1, title: "(내용 없음)" });
  return events;
}

function checkDaySequence(days: DayBlock[], warnings: ModetourImportWarning[]): void {
  if (days.length === 0) return;
  const nums = [...days.map((d) => d.dayNumber)].sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== i + 1) {
      warnings.push({
        code: "DAY_SEQUENCE_INVALID",
        message: `Day 번호가 1부터 연속이 아닙니다: ${nums.join(", ")}`,
        path: "itinerary.days[].dayNumber",
      });
      break;
    }
  }
}

export function parseItineraryText(itineraryText: string): {
  itinerary: ModetourImportV1["itinerary"];
  warnings: ModetourImportWarning[];
} {
  const warnings: ModetourImportWarning[] = [];
  const text = itineraryText.trim();
  if (!text) {
    warnings.push({
      code: "ITINERARY_MISSING",
      message: "일정 원문이 비어 있습니다.",
      path: "itinerary",
    });
    return { itinerary: undefined, warnings };
  }

  const blocks = splitByDayBlocks(text);
  if (blocks.length === 0) {
    warnings.push({
      code: "ITINERARY_PARSE_UNCERTAIN",
      message: "Day 패턴을 찾지 못했습니다. raw.textSnippets.itinerary를 확인하세요.",
      path: "itinerary",
    });
    const days: NonNullable<ModetourImportV1["itinerary"]>["days"] = [
      {
        dayNumber: 1,
        descriptionText: text.slice(0, 5000),
        events: [{ order: 1, title: "(원문 파싱 실패)", descriptionText: text.slice(0, 2000) }],
      },
    ];
    return { itinerary: { days }, warnings };
  }

  const days: DayBlock[] = blocks.map((b) => {
    const blockText = text.slice(b.start, b.end);
    const firstLineEnd = blockText.indexOf("\n");
    const firstLine = firstLineEnd >= 0 ? blockText.slice(0, firstLineEnd) : blockText;
    const rest = firstLineEnd >= 0 ? blockText.slice(firstLineEnd + 1) : "";
    const dateMatch = firstLine.match(/(\d{4}[.-]\d{1,2}[.-]\d{1,2})/);
    const dateText = dateMatch ? dateMatch[1] : undefined;
    const title = firstLine
      .replace(/\d{1,2}일차/g, "")
      .replace(/Day\s*\d+/gi, "")
      .replace(/\d{4}[.-]\d{1,2}[.-]\d{1,2}/g, "")
      .trim() || undefined;
    return {
      dayNumber: b.num,
      title,
      dateText,
      events: parseEventLines(rest),
    };
  });

  checkDaySequence(days, warnings);

  const itinerary: ModetourImportV1["itinerary"] = {
    days: days.map((d) => ({
      dayNumber: d.dayNumber,
      title: d.title,
      dateText: d.dateText,
      descriptionText: d.descriptionText,
      events: d.events,
    })),
  };
  return { itinerary, warnings };
}

```

---

## `tools/modetour-extractor-extension/src/lib/parseText.ts`

* 역할: parseNightsDays(메타), parseDayPatternsFromText(Day 정규식 fallback, 이벤트는 나머지 줄 전체를 title로 매핑).

```ts
/**
 * "n박 m일" 형태 파싱. 예: "3박 5일", "2박 3일"
 */
export function parseNightsDays(text: string): { nights?: number; days?: number } {
  const m = text.match(/(\d+)\s*박\s*(\d+)\s*일/);
  if (!m) return {};
  const nights = parseInt(m[1], 10);
  const days = parseInt(m[2], 10);
  return {
    nights: Number.isNaN(nights) ? undefined : nights,
    days: Number.isNaN(days) ? undefined : days,
  };
}

/**
 * Day N / N일차 패턴으로 일정 블록 파싱 (fallback).
 * 반환: { dayNumber, title?, dateText?, events: [{ order, title?, ... }] }[]
 */
export function parseDayPatternsFromText(fullText: string): Array<{
  dayNumber: number;
  title?: string;
  dateText?: string;
  events: Array<{
    order: number;
    timeText?: string;
    title?: string;
    typeText?: string;
    descriptionText?: string;
  }>;
}> {
  const days: Array<{
    dayNumber: number;
    title?: string;
    dateText?: string;
    events: Array<{
      order: number;
      timeText?: string;
      title?: string;
      typeText?: string;
      descriptionText?: string;
    }>;
  }> = [];

  // Day 1 / 1일차 / [1일차] 등 패턴
  const dayRegex = /(?:Day\s*)?(\d+)\s*일차|\[(\d+)\s*일차\]|Day\s*(\d+)/gi;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  const dayStarts: { num: number; index: number }[] = [];

  while ((m = dayRegex.exec(fullText)) !== null) {
    const num = parseInt(m[1] ?? m[2] ?? m[3], 10);
    if (Number.isFinite(num)) dayStarts.push({ num, index: m.index });
  }

  if (dayStarts.length === 0) return days;

  for (let i = 0; i < dayStarts.length; i++) {
    const start = dayStarts[i].index;
    const end = i + 1 < dayStarts.length ? dayStarts[i + 1].index : fullText.length;
    const block = fullText.slice(start, end);
    const firstLineEnd = block.indexOf("\n");
    const firstLine = firstLineEnd >= 0 ? block.slice(0, firstLineEnd) : block;
    const rest = firstLineEnd >= 0 ? block.slice(firstLineEnd + 1).trim() : "";

    // 첫 줄에서 날짜/제목 추출 (선택)
    let title: string | undefined;
    let dateText: string | undefined;
    const dateMatch = firstLine.match(/(\d{4}[.-]\d{1,2}[.-]\d{1,2})/);
    if (dateMatch) dateText = dateMatch[1];
    title = firstLine.replace(dayRegex, "").replace(/\d{4}[.-]\d{1,2}[.-]\d{1,2}/g, "").trim() || undefined;

    const lines = rest.split(/\n/).filter((l) => l.trim());
    const events = lines.map((line, idx) => ({
      order: idx + 1,
      title: line.trim().slice(0, 200) || undefined,
      descriptionText: line.trim().length > 200 ? line.trim().slice(200) : undefined,
    }));

    days.push({
      dayNumber: dayStarts[i].num,
      title: title || undefined,
      dateText,
      events: events.length ? events : [{ order: 1, title: "(내용 없음)" }],
    });
  }

  return days;
}

```

---

## `tools/modetour-extractor-extension/src/lib/sectionScope.ts`

* 역할: 일정 키워드로 헤딩·섹션 컨테이너를 찾고 clampSectionByNextHeading으로 텍스트 범위 제한. getScopedSection은 modetour.ts에서 일정 텍스트·container 제공.

```ts
/**
 * 섹션 범위 자르기(경계 고정).
 * 헤딩을 찾은 뒤 "그 헤딩이 속한 섹션 컨테이너"만 구하고, 다음 동급/상위 헤딩 앞까지만 범위 제한.
 */

const HEADING_SELECTORS = "h1, h2, h3, h4, h5, h6, strong, [role='tab'], button, [class*='title'], [class*='heading']";

const MIN_CONTAINER_TEXT = 200;

/**
 * h1~h4, strong, [role="tab"], button 등에서 키워드 매칭하는 첫 노드 반환
 */
export function findHeadingNode(keywords: string[]): Element | null {
  if (typeof document === "undefined") return null;
  const kws = keywords.map((k) => k.toLowerCase().trim()).filter(Boolean);
  if (kws.length === 0) return null;

  const candidates = document.querySelectorAll(HEADING_SELECTORS);
  for (const el of candidates) {
    const text = (el as HTMLElement).textContent?.trim() ?? "";
    const lower = text.toLowerCase();
    if (kws.some((k) => lower.includes(k))) return el;
  }
  return null;
}

/**
 * headingNode에서 위로 올라가며 section/article/div 중 "내용 블록"처럼 보이는 컨테이너 탐색.
 */
export function getSectionContainer(headingNode: Element): Element {
  let best: Element = headingNode.parentElement ?? headingNode;
  let bestScore = -1;

  let current: Element | null = headingNode.parentElement;
  while (current) {
    const text = (current as HTMLElement).textContent?.trim() ?? "";
    const tag = current.tagName.toLowerCase();
    const role = current.getAttribute("role");
    const cls = (current.className?.toString() ?? "").toLowerCase();

    const isBlock =
      tag === "section" ||
      tag === "article" ||
      tag === "main" ||
      tag === "div" ||
      role === "region" ||
      cls.includes("content") ||
      cls.includes("section") ||
      cls.includes("panel") ||
      cls.includes("tab-panel") ||
      cls.includes("itinerary") ||
      cls.includes("schedule");

    if (isBlock && text.length >= MIN_CONTAINER_TEXT) {
      const headingCount = current.querySelectorAll(HEADING_SELECTORS).length;
      const score = text.length + headingCount * 50;
      if (score > bestScore) {
        bestScore = score;
        best = current;
      }
    }
    current = current.parentElement;
  }

  return best;
}

/**
 * container 내부에서 headingNode 다음에 나오는 첫 헤딩 역할 요소를 document 순서로 반환
 */
function findNextHeadingInContainer(container: Element, afterNode: Element): Element | null {
  const isHeadingLike = (el: Element): boolean => {
    const tag = el.tagName.toLowerCase();
    return /^h[1-6]$/.test(tag) || tag === "strong" || el.getAttribute("role") === "tab";
  };
  if (!container.contains(afterNode)) return null;
  const descendants = Array.from(container.querySelectorAll("*"));
  let startIdx = 0;
  if (afterNode !== container) {
    const i = descendants.indexOf(afterNode);
    if (i < 0) return null;
    startIdx = i + 1;
  }
  for (let j = startIdx; j < descendants.length; j++) {
    const el = descendants[j];
    if (isHeadingLike(el) && (el as HTMLElement).textContent?.trim()) return el;
  }
  return null;
}

/**
 * container의 텍스트에서 "heading 노드 텍스트 ~ 다음 헤딩 텍스트 앞" 구간만 잘라 반환.
 */
export function clampSectionByNextHeading(container: Element, headingNode: Element): string {
  const fullText = (container as HTMLElement).textContent ?? "";
  const headingText = (headingNode as HTMLElement).textContent?.trim() ?? "";
  const nextEl = findNextHeadingInContainer(container, headingNode);

  let start = 0;
  const headingIdx = headingText ? fullText.indexOf(headingText) : -1;
  if (headingIdx >= 0) start = headingIdx;

  let end = fullText.length;
  if (nextEl) {
    const nextText = (nextEl as HTMLElement).textContent?.trim() ?? "";
    if (nextText) {
      const nextIdx = fullText.indexOf(nextText, start);
      if (nextIdx > start) end = nextIdx;
    }
  }

  return fullText.slice(start, end).trim();
}

export type ScopedSectionResult = {
  container: Element | null;
  text: string;
  node: Element | null;
  warning?: string;
};

const DEFAULT_MAX_LEN = 5000;
const MIN_SCOPE_LEN = 100;

/**
 * keywords로 헤딩 찾기 → 섹션 컨테이너 구하기 → 헤딩~다음 헤딩 앞까지만 텍스트 추출.
 */
export function getScopedSection(
  keywords: string[],
  maxLen = DEFAULT_MAX_LEN,
): ScopedSectionResult {
  if (typeof document === "undefined") {
    return { container: null, text: "", node: null, warning: "ITINERARY_SCOPE_NOT_FOUND" };
  }

  const heading = findHeadingNode(keywords);
  if (!heading) {
    return { container: null, text: "", node: null, warning: "ITINERARY_SCOPE_NOT_FOUND" };
  }

  const container = getSectionContainer(heading);
  let text = clampSectionByNextHeading(container, heading);

  text = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+/g, " ")
    .trim();

  if (text.length > maxLen) text = text.slice(0, maxLen) + "\n…(truncated)";

  if (text.length < MIN_SCOPE_LEN) {
    return {
      container,
      text,
      node: heading,
      warning: "ITINERARY_SCOPE_TOO_SHORT",
    };
  }

  return { container, text, node: heading };
}

```

---

## `tools/modetour-extractor-extension/src/lib/selectors.ts`

* 역할: 상품/일정/갤러리 등 CSS 셀렉터 배열, queryFirst/queryText, 이미지 URL 헬퍼(getImageUrl 등).

```ts
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

```

---

## `tools/modetour-extractor-extension/src/lib/modetourUiPrep.ts`

* 역할: 추출 전 일정 탭 클릭·아코디언 펼침·일차 DOM 대기. DOM이 렌더되기 전 추출 방지 보조.

```ts
/**
 * 추출 전 UI 준비: 일정 탭 활성화 + 일정 DOM 존재 대기.
 * expandedCount는 토글 클릭 수가 아니라 "day 컨테이너 탐지 개수"로 대체.
 */

const TAB_KEYWORDS = ["일정", "여행일정", "상세일정"];
const TAB_WAIT_MS = 500;
const ACCORDION_MAX_CLICKS = 20;
const ACCORDION_CLICK_INTERVAL_MS = 150;
const ACCORDION_AFTER_MS = 500;
const WAIT_FOR_ILCHA_POLL_MS = 200;
const WAIT_FOR_ILCHA_MAX_MS = 2000;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export type PrepareItineraryUiResult = {
  didClickTab: boolean;
  /** day 컨테이너 탐지 개수 (aria-expanded 토글 수 아님) */
  expandedCount: number;
  debug: {
    tabText?: string;
    expandedButtonCount: number;
    firstDayHeaderTexts: string[];
  };
};

/**
 * document.body.innerText에 "일차" 포함 여부를 폴링. 최대 2초.
 */
async function waitForItineraryDom(): Promise<boolean> {
  const deadline = Date.now() + WAIT_FOR_ILCHA_MAX_MS;
  while (Date.now() < deadline) {
    if (typeof document !== "undefined" && document.body?.innerText?.includes("일차")) {
      return true;
    }
    await sleep(WAIT_FOR_ILCHA_POLL_MS);
  }
  return false;
}

/**
 * Day 컨테이너 후보 개수: "n일차" 텍스트를 가진 헤더/블록 개수.
 */
function countDayContainers(): number {
  if (typeof document === "undefined") return 0;
  const seen = new Set<number>();
  const candidates = document.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, strong, [class*='day'], [class*='Day']",
  );
  for (const el of candidates) {
    const t = (el as HTMLElement).textContent?.trim() ?? "";
    const m = t.match(/(\d{1,2})일차/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 31) seen.add(n);
    }
  }
  return seen.size;
}

/**
 * "일정" 탭을 찾아 클릭한 뒤, 일정 DOM(일차 텍스트)이 나올 때까지 대기.
 * aria-expanded 토글 클릭은 시도하되, expandedCount는 day 컨테이너 탐지 개수로 반환.
 */
export async function prepareItineraryUi(): Promise<PrepareItineraryUiResult> {
  const debug = { expandedButtonCount: 0, firstDayHeaderTexts: [] as string[] };
  let didClickTab = false;

  if (typeof document === "undefined") {
    return { didClickTab, expandedCount: 0, debug };
  }

  const tabCandidates = document.querySelectorAll(
    '[role="tab"], button, a[href="#"], a[role="button"]',
  );
  for (const el of tabCandidates) {
    const text = (el as HTMLElement).textContent?.trim() ?? "";
    const lower = text.toLowerCase();
    if (TAB_KEYWORDS.some((k) => lower.includes(k))) {
      (el as HTMLElement).click();
      didClickTab = true;
      debug.tabText = text.slice(0, 50);
      await sleep(TAB_WAIT_MS);
      break;
    }
  }

  await waitForItineraryDom();

  const collapsedButtons: HTMLElement[] = [];
  document.querySelectorAll('button[aria-expanded="false"], [aria-expanded="false"] button').forEach((el) => {
    const btn = el as HTMLElement;
    const container = btn.closest("div, li, section");
    const context = container
      ? (container.textContent ?? "").trim()
      : (btn.textContent ?? "").trim() + (btn.parentElement?.textContent ?? "");
    if (/일차/.test(context)) {
      collapsedButtons.push(btn);
    }
  });

  if (collapsedButtons.length === 0) {
    document.querySelectorAll("button, [role='button']").forEach((el) => {
      const btn = el as HTMLElement;
      const ctx = (btn.closest("[class*='day'], [class*='Day'], [class*='accordion']")?.textContent ?? "") + (btn.textContent ?? "");
      if (/일차/.test(ctx) && btn.getAttribute("aria-expanded") === "false") {
        collapsedButtons.push(btn);
      }
    });
  }

  const seen = new WeakSet<HTMLElement>();
  let clicks = 0;
  for (const btn of collapsedButtons) {
    if (clicks >= ACCORDION_MAX_CLICKS) break;
    if (seen.has(btn)) continue;
    seen.add(btn);
    btn.click();
    clicks++;
    debug.expandedButtonCount = clicks;
    await sleep(ACCORDION_CLICK_INTERVAL_MS);
  }

  await sleep(ACCORDION_AFTER_MS);

  const dayHeaderEls = document.querySelectorAll(
    "h1, h2, h3, h4, h5, h6, strong, [class*='day'], [class*='Day']",
  );
  for (const el of dayHeaderEls) {
    const t = (el as HTMLElement).textContent?.trim() ?? "";
    if (/(\d{1,2})일차/.test(t) && debug.firstDayHeaderTexts.length < 3) {
      debug.firstDayHeaderTexts.push(t.slice(0, 80));
    }
  }

  const expandedCount = countDayContainers();
  return { didClickTab, expandedCount, debug };
}

```

---

## `tools/modetour-extractor-extension/src/lib/extractTypes.ts`

* 역할: ExtractedDomData / ExtractMeta 타입. itinerary·itineraryDomDebug 필드 정의.

```ts
/**
 * Content script에서 추출한 원시 DOM 데이터.
 * buildImport.ts에서 ModetourImportV1으로 변환.
 */

export type ExtractedDomData = {
  source: {
    url: string;
    fetchedAtISO: string;
  };
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
  inclusions?: {
    includedText?: string;
    excludedText?: string;
    includedItems?: string[];
    excludedItems?: string[];
  };
  terms?: {
    termsText?: string;
    cancelText?: string;
    noticeText?: string;
  };
  /** 탭형 상세정보 DOM 파싱 결과 */
  detailTabs?: {
    scheduleNotice?: { title: string; rawText: string; sections: { heading?: string | null; lines: string[] }[]; lines: string[] } | null;
    bookingTerms?: { title: string; rawText: string; sections: { heading?: string | null; lines: string[] }[]; lines: string[] } | null;
    cancellationPolicy?: { title: string; rawText: string; sections: { heading?: string | null; lines: string[] }[]; lines: string[] } | null;
  };
  media?: {
    heroImageUrl?: string;
    galleryImageUrls: string[];
    unassignedImageUrls: string[];
  };
  /** raw 스니펫 (파싱 실패/불확실 시 원문) */
  rawSnippets?: {
    itinerary?: string;
    inclusions?: string;
    terms?: string;
    /** DOM 일정 파서 실패 시 디버깅용 힌트 (dayHeader 텍스트, 첫 컨테이너 앞부분 등) */
    itineraryDomHint?: string;
  };
  /** DOM에서 어떤 섹션을 찾지 못했는지 */
  missingSections?: string[];
};

/** 추출 시 사용한 소스 (팝업 배지용) */
export type ExtractMeta = {
  usedJsonLd: boolean;
  usedItineraryText: boolean;
  /** 일정 추출 소스: DOM | TEXT | RAW */
  itinerarySource?: "DOM" | "TEXT" | "RAW";
  /** DOM 일정 파서 디버그 정보 */
  itineraryDomDebug?: {
    dayHeaderCount: number;
    dayContainerCount: number;
    eventCount: number;
    eventItemCount?: number;
    eventAcceptedCount?: number;
    timelineItemCount?: number;
    cardCount?: number;
    eventCountByDay?: number[];
  };
  /** 일정 스코프 컨테이너 발견 여부 */
  itineraryScopeFound?: boolean;
  /** 일정 스코프 텍스트 길이 */
  itineraryTextLength?: number;
  /** 이미지 개수 (hero/gallery/itinerary) */
  imageCounts?: { hero: number; gallery: number; itinerary: number };
  /** 이미지 신뢰도 낮음 플래그 */
  imagesLowConfidence?: boolean;
  /** 이미지 필터 디버그: hard exclude·선택 이유 추적. 검증 미사용 시 totalValidated/failedToLoad 등은 0 */
  imageDebug?: {
    totalFound: number;
    totalAfterFilter: number;
    totalValidated: number;
    excludedDataUri: number;
    excludedSvg: number;
    excludedTracking: number;
    excludedStaticUi: number;
    excludedPolicy: number;
    excludedThumbnail: number;
    excludedDuplicate: number;
    failedToLoad: number;
    pickedFromHero: number;
    pickedFromItinerary: number;
    pickedFromDetail: number;
    pickedFromFallback: number;
    /** 검증 사용 시에만 설정; 기본 경로에서는 0 또는 undefined */
    validationAttempted?: number;
    validationTimedOut?: number;
    validationSkippedDueToLimit?: number;
    softenedFilterApplied?: boolean;
    thumbnailCandidatesRetained?: number;
    fallbackValidationAttempted?: number;
    /** scope별 raw 수집 개수 (필터 전) */
    heroRawFound?: number;
    itineraryRawFound?: number;
    fallbackRawFound?: number;
    /** itinerary 전용 필터 후 개수 */
    itineraryAfterFilter?: number;
    /** gallery에 반영한 itinerary 이미지 수 */
    itineraryAssignedCount?: number;
  };
  /** 추출 전 UI 준비: 일정 탭 클릭, 아코디언 펼침 */
  uiPrep?: {
    didClickTab: boolean;
    expandedCount: number;
    debug?: { tabText?: string; expandedButtonCount: number; firstDayHeaderTexts?: string[] };
  };
};

```

---

## `tools/modetour-extractor-extension/src/lib/buildImport.ts`

* 역할: ExtractedDomData → ModetourImportV1 변환 및 경고 코드 부여(DOM 관련 missingSections 매핑).

```ts
import type { ModetourImportV1, ModetourImportWarning } from "~types/modetourImport";
import type { ExtractedDomData } from "~lib/extractTypes";
import { truncateSnippet } from "~lib/selectors";

const SNIPPET_MAX = 5000;

function addWarning(
  list: ModetourImportWarning[],
  code: string,
  message: string,
  path?: string,
): void {
  list.push({ code, message, path });
}

/**
 * Day 번호가 1부터 연속인지 검사
 */
function checkDaySequence(
  days: NonNullable<ModetourImportV1["itinerary"]>["days"],
  warnings: ModetourImportWarning[],
): void {
  if (!days?.length) return;
  const nums = days
    .map((d) => d.dayNumber)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
  for (let i = 0; i < nums.length; i++) {
    if (nums[i] !== i + 1) {
      addWarning(
        warnings,
        "DAY_SEQUENCE_INVALID",
        `Day 번호가 1부터 연속이 아닙니다: ${nums.join(", ")}`,
        "itinerary.days[].dayNumber",
      );
      break;
    }
  }
}

/**
 * ExtractedDomData → ModetourImportV1 (warnings, raw 포함)
 * PR16 이후: payload는 source, product(title/nights/days/regionText/priceText), itinerary, media, warnings, raw 만 포함.
 * 설명/포함·불포함/약관/상세탭 필드는 설정하지 않음.
 */
export function buildModetourImportV1(extracted: ExtractedDomData): ModetourImportV1 {
  const warnings: ModetourImportWarning[] = [];

  if (!extracted.product.title?.trim()) {
    addWarning(warnings, "TITLE_MISSING", "상품명을 찾지 못했습니다.", "product.title");
  }

  if (extracted.missingSections?.includes("ITINERARY_PARSE_UNCERTAIN")) {
    addWarning(
      warnings,
      "ITINERARY_PARSE_UNCERTAIN",
      "일정을 확실히 파싱하지 못했습니다. raw.textSnippets.itinerary를 확인하세요.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_SCOPE_NOT_FOUND")) {
    addWarning(
      warnings,
      "ITINERARY_SCOPE_NOT_FOUND",
      "일정 섹션 컨테이너를 찾지 못했습니다.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_SCOPE_TOO_SHORT")) {
    addWarning(
      warnings,
      "ITINERARY_SCOPE_TOO_SHORT",
      "일정 스코프 텍스트가 너무 짧습니다.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("IMAGES_LOW_CONFIDENCE")) {
    addWarning(
      warnings,
      "IMAGES_LOW_CONFIDENCE",
      "이미지 품질/수가 불확실할 수 있습니다.",
      "media",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_DOM_NOT_FOUND")) {
    addWarning(
      warnings,
      "ITINERARY_DOM_NOT_FOUND",
      "DOM에서 일정 Day 컨테이너를 찾지 못했습니다. 텍스트 파서로 대체되었습니다.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_DOM_EVENTS_EMPTY")) {
    addWarning(
      warnings,
      "ITINERARY_DOM_EVENTS_EMPTY",
      "DOM 일정에서 이벤트 블록을 찾지 못했습니다. 텍스트 파서로 이벤트를 보완했습니다.",
      "itinerary",
    );
  }
  if (extracted.missingSections?.includes("ITINERARY_DOM_LOW_EVENTS")) {
    addWarning(
      warnings,
      "ITINERARY_DOM_LOW_EVENTS",
      "DOM 일정 이벤트 수가 적어 텍스트 파서로 보완했습니다.",
      "itinerary",
    );
  }
  if (!extracted.itinerary?.days?.length) {
    addWarning(warnings, "ITINERARY_MISSING", "상세 일정이 비어 있습니다.", "itinerary.days");
  } else {
    checkDaySequence(extracted.itinerary.days, warnings);
  }

  if (!extracted.media?.heroImageUrl?.trim()) {
    addWarning(warnings, "HERO_IMAGE_MISSING", "대표 이미지를 찾지 못했습니다.", "media.heroImageUrl");
  }

  if (extracted.missingSections?.includes("EXTRACT_ERROR")) {
    addWarning(warnings, "EXTRACT_ERROR", "DOM 추출 중 오류가 발생했습니다.", undefined);
  }

  const raw = extracted.rawSnippets
    ? {
        textSnippets: Object.fromEntries(
          Object.entries(extracted.rawSnippets)
            .filter(([, v]) => v?.trim())
            .map(([k, v]) => [k, truncateSnippet(v ?? "", k === "itineraryDomHint" ? 800 : SNIPPET_MAX)]),
        ) as Record<string, string>,
      }
    : undefined;

  if (Object.keys(raw?.textSnippets ?? {}).length === 0 && raw) {
    (raw as { textSnippets?: Record<string, string> }).textSnippets = undefined;
  }
  const finalRaw =
    raw?.textSnippets && Object.keys(raw.textSnippets).length > 0 ? raw : undefined;

  const result: ModetourImportV1 = {
    version: "modetour-import-v1",
    source: {
      provider: "modetour",
      url: extracted.source.url,
      fetchedAtISO: extracted.source.fetchedAtISO,
    },
    product: {
      title: extracted.product.title?.trim() ?? "",
      nights: extracted.product.nights,
      days: extracted.product.days,
      regionText: extracted.product.regionText?.trim() || undefined,
      priceText: extracted.product.priceText?.trim() || undefined,
    },
    itinerary: extracted.itinerary,
    media: extracted.media,
    warnings: warnings.length > 0 ? warnings : undefined,
    raw: finalRaw,
  };

  return result;
}

```

---

## 추가 확인 포인트 (분석 메모)

### 1. 사진이 없는 이벤트를 버릴 수 있는 조건

- **타임라인 DOM** (`extractEventsInOrder` → timeline 분기): `getTimelineContentRoot(el)`가 없으면 `continue`. 제목 `getTimelineTitle`이 비면 `continue`. **핵심**: `descriptionText.length <= MIN_DESCRIPTION_FOR_ACCEPT (10)` 이고 **동시에** `imageUrls.length === 0`이면 `continue`로 이벤트 미채택. 즉 짧은 설명 + 사진 없음이면 통째로 스킵.
- **타임라인 행 자체**: `getTimelineItems`는 행 전체 텍스트 길이가 **20 미만**이면 후보에서 제외. 짧은 한 줄 이벤트는 타임라인 후보가 안 될 수 있음.
- **카드형**: `getCardTitle`이 비면 스킵. 카드는 이미지 없어도 title만 있으면 채택 가능(별도 MIN_DESCRIPTION 조건 없음).
- **이벤트 간 중복**: 동일 dedupe 키(타임라인은 URL 정규화 기반 수집)로 나중 슬롯만 제거되는 것은 본 발췌 범위의 **자동정리 PR**이 아니라 DOM 파서 단계에서는 타임라인의 위 조건이 주 원인.

### 2. description 길이 조건이 있는지

- 타임라인: **예.** `MIN_DESCRIPTION_FOR_ACCEPT = 10` — 설명이 10자 이하이고 이미지도 없으면 제외. 설명은 `div[id^="content"]`에서만 추출; 해당 노드가 없으면 빈 문자열 → 이미지 없으면 제외.
- 카드: 설명 길이 하한 없음(제목 필수).
- 텍스트 파서 `itineraryParser`: `isEventLine`에서 `MIN_EVENT_LINE_LEN = 4`, 금지어 등. 짧은 줄은 이벤트 줄이 아닐 수 있음.

### 3. imageUrls 존재 여부가 acceptance 조건에 들어가는지

- **타임라인**: 직접 조건은 아니나, **설명이 짧을 때** 이미지가 있으면 살림 — `(descriptionText.length <= 10 && imageUrls.length === 0) continue` 이므로 이미지가 있으면 이 분기를 통과.

### 4. title만 있어도 이벤트로 채택되는지

- **타임라인**: title만 있고 설명 ≤10자이고 이미지 없음 → **채택 안 됨**. title만 있고 설명 >10자 → 채택 가능.
- **카드**: title만 있으면 **채택 가능**(이미지 선택).

### 5. 출발/도착/이동/입국수속/체크인/식사 등 짧은 이벤트가 누락될 가능성이 있는 분기

- 타임라인 UI에서 본문이 짧거나 `id^="content"` 블록이 비어 있고 사진도 없으면 **전부 스킵**.
- `getTimelineItems`의 **전체 텍스트 20자 미만** 필터로 한 줄짜리 행 제외 가능.
- 카드형이 아닌 레이아웃만 쓰는 짧은 행은 타임라인 셀렉터(`space-x-[6px]`, `flex`+stretch 등)에 안 걸리면 **목록 자체에 없음**.
- `findDayContainer`: 부모 중 텍스트 **200자 미만**이면 스킵, **2개 이상 Day 헤더 포함**이면 스킵 등으로 Day 단위가 잘리면 그 안 이벤트 전부 영향.

### 6. DOM 파서 실패 시 text parser fallback 구조

- `modetour.ts`: `domSuccess` = day≥1 && 총 이벤트≥1. **저이벤트**(`totalDomEvents <= days.length`)면 텍스트로 Day별 보완. **day는 있는데 이벤트 0**이면 `ITINERARY_DOM_EVENTS_EMPTY` 후 텍스트 merge.
- **DOM 완전 실패**(day 0 등): `ITINERARY_DOM_NOT_FOUND` 후 `itinerary` 미설정 시 `parseItineraryText(sectionItineraryText)` → 실패 시 `parseDayPatternsFromText(itineraryFullText)` → `parseItineraryText` 재시도 등 순차 폴백.
- `itinerarySource === "DOM"`일 때는 `itineraryScope.container` 기반 이미지 할당 블록(`extractImageUrlsFromNode`)이 **실행되지 않음**. 발췌 시점 `modetour.ts`에는 해당 심볼 import가 없어, `itinerarySource !== "DOM"` 경로에서 해당 줄이 실행되면 **런타임 ReferenceError** 가능.

---
## 발췌에 포함된 파일 목록

- `tools/modetour-extractor-extension/src/lib/itineraryDom.ts`
- `tools/modetour-extractor-extension/src/contents/modetour.ts`
- `tools/modetour-extractor-extension/src/lib/itineraryParser.ts`
- `tools/modetour-extractor-extension/src/lib/parseText.ts`
- `tools/modetour-extractor-extension/src/lib/sectionScope.ts`
- `tools/modetour-extractor-extension/src/lib/selectors.ts`
- `tools/modetour-extractor-extension/src/lib/modetourUiPrep.ts`
- `tools/modetour-extractor-extension/src/lib/extractTypes.ts`
- `tools/modetour-extractor-extension/src/lib/buildImport.ts`
