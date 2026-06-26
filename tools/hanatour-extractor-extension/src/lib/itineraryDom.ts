/**
 * DOM 기반 일정 추출: Day 컨테이너 단위로 분리, 이벤트 블록에서 title/description/imageUrls 추출.
 */

import type { HanatourImportV1, HanatourImportWarning } from "~types/hanatourImport";
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

function getTimelineItems(dayContainer: Element): Element[] {
  const out: Element[] = [];
  const candidates = dayContainer.querySelectorAll('div[class*="flex"][class*="items-stretch"][class*="justify-start"]');
  for (const el of candidates) {
    const cls = (el.className && typeof el.className === "string" ? el.className : "") || "";
    if (cls.includes("space-x-[12px]")) continue;
    if (!cls.includes("space-x-[6px]")) continue;
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

export type PanelEventsResult = {
  events: NonNullable<HanatourImportV1["itinerary"]>["days"][number]["events"];
  timelineItemCount: number;
  cardCount: number;
  acceptedCount: number;
};

/** 패널 scope에서 타임라인·카드 이벤트 추출 (하나투어 일차 패널 등). */
export function extractEventsFromPanelScope(
  panel: Element,
  excludeInside?: Element | null,
): PanelEventsResult {
  const exclude =
    excludeInside ??
    (panel.ownerDocument?.createElement("div") ?? panel);
  return extractEventsInOrder(panel, exclude);
}

function extractEventsInOrder(
  dayContainer: Element,
  dayHeaderEl: Element,
): PanelEventsResult {
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
  const events: NonNullable<HanatourImportV1["itinerary"]>["days"][number]["events"] = [];
  let order = 0;

  for (const { el, type } of allNodes) {
    if (type === "timeline") {
      const contentRoot = getTimelineContentRoot(el);
      if (!contentRoot) continue;
      const title = getTimelineTitle(contentRoot).trim();
      if (!title) continue;
      const descriptionText = getTimelineDescription(contentRoot);
      const base = (contentRoot.ownerDocument?.defaultView as Window | undefined)?.location?.href ?? "https://www.hanatour.com/";
      let imageUrls = getEventImageCandidates(contentRoot, base);
      if (imageUrls.length === 0) {
        const firstUrl = getFirstImageUrlInContainer(contentRoot, base);
        if (firstUrl) imageUrls = [firstUrl];
      }
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
      const title = getCardTitle(el).trim();
      if (!title) continue;
      const descriptionText = getCardDescription(el);
      if (seenTitles.has(title)) {
        const existing = events.find((e) => e.title === title);
        if (existing && descriptionText) existing.descriptionText = (existing.descriptionText ?? "") + "\n" + descriptionText;
        continue;
      }
      seenTitles.add(title);
      order += 1;
      const base = (el.ownerDocument?.defaultView as Window | undefined)?.location?.href ?? "https://www.hanatour.com/";
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
  days: NonNullable<HanatourImportV1["itinerary"]>["days"];
  warnings: HanatourImportWarning[];
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
  const warnings: HanatourImportWarning[] = [];
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

  const days: NonNullable<HanatourImportV1["itinerary"]>["days"] = [];

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

    const base = (dayContainer.ownerDocument?.defaultView as Window | undefined)?.location?.href ?? "https://www.hanatour.com/";
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
