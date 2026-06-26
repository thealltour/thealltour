/**
 * 하나투어 여행일정 DOM 파서 — 일차 서브탭/아코디언 순회 + 카드·타임라인 구조 추출.
 */

import type { HanatourImportV1, HanatourImportWarning } from "~types/hanatourImport";
import { extractEventsFromPanelScope } from "~lib/itineraryDom";
import {
  activateDayTab,
  clickExpandAllItinerary,
  clickMainItineraryTab,
  expandAccordionsIn,
  findDayAccordionEntries,
  findDaySubTabs,
  sleep,
  type HanatourDaySubTab,
} from "~lib/hanatourUiPrep";
import {
  collectAllImageUrlsInScope,
  getFirstImageUrlInContainer,
  isHanatourUiStockImage,
  scoreImageCandidate,
} from "~lib/images";
import { countRealEvents, PLACEHOLDER_EVENT_TITLE } from "~lib/mergeItineraryEvents";

const DATE_IN_HEADER = /(\d{1,2}\/\d{1,2}\([^)]+\)|\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})/;
const TIME_PATTERN = /\b([01]?\d|2[0-3]):[0-5]\d\b/;
const UI_SKIP =
  /일정\s*전체\s*펼침|이전일차|다음일차|여행일정\s*변경|상세내용을\s*확인|일정\s*상세보기/i;
const MEAL_LINE = /^(조식|중식|석식|기내|기내식|중식\s*또는\s*석식|석식\s*또는\s*중식)/;
const SECTION_LABEL = /^(예정호텔|호텔|식사|항공)$/;
const MAX_DESCRIPTION_LEN = 2000;

export type HanatourParserStrategy = "timelineCard" | "hanatourCard" | "lineFallback" | "merged";

export type HanatourEventSourceCounts = {
  timeline: number;
  section: number;
  location: number;
  sightseeing: number;
  notice: number;
  meal: number;
};

type DayEvent = NonNullable<HanatourImportV1["itinerary"]>["days"][number]["events"][number];
type Day = NonNullable<HanatourImportV1["itinerary"]>["days"][number];

type AnchoredEvent = {
  anchor: Element;
  source: keyof HanatourEventSourceCounts;
  event: Omit<DayEvent, "order">;
};

function getElementText(el: Element): string {
  const html = el as HTMLElement;
  return html.innerText ?? html.textContent ?? "";
}

function inferEventType(title: string, description: string): string {
  const combined = `${title} ${description}`;
  if (/호텔|숙소|예정호텔/i.test(combined)) return "hotel";
  if (/식사|조식|중식|석식|기내/i.test(combined)) return "meal";
  if (/출발|도착|항공|공항|비행|입국|출국/i.test(combined)) return "flight";
  if (/유의|안내|참고|출입국/i.test(combined)) return "notice";
  return "activity";
}

function isSkippableTitle(title: string): boolean {
  if (!title || title === PLACEHOLDER_EVENT_TITLE) return true;
  if (UI_SKIP.test(title)) return true;
  if (title === "상세보기") return true;
  return false;
}

function extractImagesFromScope(scope: Element, base: string): string[] {
  const urls = collectAllImageUrlsInScope(scope, base)
    .filter((u) => !isHanatourUiStockImage(u))
    .sort((a, b) => scoreImageCandidate(b) - scoreImageCandidate(a));
  return urls.slice(0, 12);
}

function hasBorderAndRounded(el: Element): boolean {
  const cls = (el.className && typeof el.className === "string" ? el.className : "") || "";
  return cls.includes("border") && cls.includes("rounded");
}

function hasDetailViewLink(el: Element): boolean {
  return Array.from(el.querySelectorAll("a")).some((a) => /상세보기/.test(a.textContent ?? ""));
}

function dedupeSmallestCards(candidates: Element[]): Element[] {
  return candidates.filter((el, i) => {
    for (let j = 0; j < candidates.length; j++) {
      if (i === j) continue;
      if (el.contains(candidates[j]) && el !== candidates[j]) return false;
    }
    return true;
  });
}

function getCardDescriptionText(card: Element, title: string): string {
  const raw = getElementText(card);
  let text = raw
    .replace(title, "")
    .replace(/상세보기/g, "")
    .trim()
    .replace(/\s+/g, " ");
  if (text.length > MAX_DESCRIPTION_LEN) text = text.slice(0, MAX_DESCRIPTION_LEN) + "…";
  return text;
}

function getTimelineTitleEl(contentRoot: Element): Element | null {
  return (
    contentRoot.querySelector('div[class*="text-[17px]"][class*="font-semibold"]') ??
    contentRoot.querySelector('[class*="font-semibold"]') ??
    contentRoot.querySelector("strong, h3, h4, h5")
  );
}

function isLikelyLocationTitle(title: string): boolean {
  const t = title.trim();
  if (t.length < 2 || t.length > 20) return false;
  if (SECTION_LABEL.test(t)) return false;
  if (MEAL_LINE.test(t)) return false;
  if (/^\d+일차/.test(t)) return false;
  if (/출입국|유의사항|예약\s*전/.test(t)) return false;
  return true;
}

function collectTimelineRows(panel: Element): Element[] {
  const out: Element[] = [];
  const candidates = panel.querySelectorAll(
    'div[class*="flex"][class*="items-stretch"], div[class*="flex"][class*="items-start"]',
  );
  for (const el of candidates) {
    const cls = (el.className && typeof el.className === "string" ? el.className : "") || "";
    if (cls.includes("space-x-[6px]") || cls.includes("space-x-[12px]")) {
      out.push(el);
    }
  }
  return out;
}

function extractSectionLabelEvents(panel: Element, base: string): AnchoredEvent[] {
  const out: AnchoredEvent[] = [];
  const sectionLabels = ["예정호텔", "호텔", "식사", "항공"];
  panel.querySelectorAll("div, section, article, li").forEach((block) => {
    const raw = getElementText(block).trim();
    if (raw.length < 8 || raw.length > 3000) return;
    for (const label of sectionLabels) {
      if (!raw.startsWith(label)) continue;
      const rest = raw.slice(label.length).trim();
      if (rest.length < 3) continue;
      const imgs = extractImagesFromScope(block, base);
      out.push({
        anchor: block,
        source: "section",
        event: {
          title: label,
          descriptionText: rest.slice(0, MAX_DESCRIPTION_LEN),
          typeText: inferEventType(label, rest),
          imageUrls: imgs.length ? imgs : undefined,
        },
      });
      break;
    }
  });
  return out;
}

function getTimelineRowText(contentRoot: Element): string {
  const titleEl = getTimelineTitleEl(contentRoot);
  if (titleEl?.textContent?.trim()) return titleEl.textContent.trim();
  const text = getElementText(contentRoot).trim();
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean);
  return firstLine ?? "";
}

function extractHanatourLocationEvents(panel: Element): AnchoredEvent[] {
  const out: AnchoredEvent[] = [];
  const rows = collectTimelineRows(panel);

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const contentRoot =
      row.querySelector('div[class*="w-[calc(100%_-_24px)]"]') ??
      row.querySelector('div[class*="calc(100%"]') ??
      row;
    const title = getTimelineRowText(contentRoot).slice(0, 300);
    if (!isLikelyLocationTitle(title)) continue;

    const descriptions: string[] = [];
    for (let j = i + 1; j < rows.length; j++) {
      const nextRow = rows[j];
      const nextRoot =
        nextRow.querySelector('div[class*="w-[calc(100%_-_24px)]"]') ??
        nextRow.querySelector('div[class*="calc(100%"]') ??
        nextRow;
      const nextTitle = getTimelineRowText(nextRoot);
      if (isLikelyLocationTitle(nextTitle)) break;
      if (!nextTitle || nextTitle.length > 120) continue;
      if (UI_SKIP.test(nextTitle)) continue;
      descriptions.push(nextTitle);
    }

    out.push({
      anchor: row,
      source: "location",
      event: {
        title,
        typeText: "location",
        descriptionText: descriptions.length ? descriptions.join("\n").slice(0, MAX_DESCRIPTION_LEN) : undefined,
      },
    });
  }

  return out;
}

function findSightseeingCardElements(panel: Element): Element[] {
  const raw: Element[] = [];
  panel.querySelectorAll("div, section, article").forEach((el) => {
    const hasDetail = hasDetailViewLink(el);
    const bordered = hasBorderAndRounded(el);
    if (!hasDetail && !bordered) return;

    const titleEl =
      el.querySelector('[class*="font-semibold"]') ??
      el.querySelector("strong, h3, h4, h5");
    if (!titleEl) return;
    const title = titleEl.textContent?.trim() ?? "";
    if (!title || title.length > 80 || isSkippableTitle(title)) return;
    if (SECTION_LABEL.test(title)) return;
    const textLen = getElementText(el).length;
    if (!hasDetail && textLen < 20) return;
    raw.push(el);
  });
  return dedupeSmallestCards(raw);
}

function extractHanatourSightseeingEvents(panel: Element, base: string): AnchoredEvent[] {
  const out: AnchoredEvent[] = [];
  const cards = findSightseeingCardElements(panel);
  for (const card of cards) {
    const titleEl =
      card.querySelector('[class*="font-semibold"]') ??
      card.querySelector("strong, h3, h4, h5");
    const title = titleEl?.textContent?.trim()?.slice(0, 300) ?? "";
    if (!title || isSkippableTitle(title)) continue;
    const descriptionText = getCardDescriptionText(card, title);
    const imgs = extractImagesFromScope(card, base);
    out.push({
      anchor: card,
      source: "sightseeing",
      event: {
        title,
        descriptionText: descriptionText || undefined,
        typeText: "sightseeing",
        imageUrls: imgs.length ? imgs : undefined,
      },
    });
  }
  return out;
}

function extractHanatourNoticeEvents(panel: Element, base: string): AnchoredEvent[] {
  const out: AnchoredEvent[] = [];
  const noticeHeaders = ["출입국 정보", "예약 전 유의사항", "유의사항", "안내사항"];

  panel.querySelectorAll("div, section, article").forEach((block) => {
    const raw = getElementText(block).trim();
    if (raw.length < 20 || raw.length > 8000) return;
    for (const header of noticeHeaders) {
      if (!raw.startsWith(header) && !raw.includes(header)) continue;
      const title = header;
      const rest = raw.replace(header, "").replace(/상세보기/g, "").trim();
      if (rest.length < 10) continue;
      const imgs = extractImagesFromScope(block, base);
      out.push({
        anchor: block,
        source: "notice",
        event: {
          title,
          descriptionText: rest.slice(0, MAX_DESCRIPTION_LEN),
          typeText: "notice",
          imageUrls: imgs.length ? imgs : undefined,
        },
      });
      break;
    }
  });
  return out;
}

function extractMealLineEvents(panel: Element): AnchoredEvent[] {
  const out: AnchoredEvent[] = [];
  const lines = getElementText(panel)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length >= 2 && l.length <= 80);

  lines.forEach((line, idx) => {
    if (UI_SKIP.test(line) || /^\d+일차/.test(line)) return;
    if (!MEAL_LINE.test(line)) return;
    out.push({
      anchor: panel,
      source: "meal",
      event: { title: line.slice(0, 300), typeText: "meal" },
    });
    void idx;
  });
  return out;
}

function eventMergeKey(event: Omit<DayEvent, "order">): string {
  const title = (event.title ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const time = (event.timeText ?? "").trim();
  return `${time}__${title}`;
}

const SOURCE_PRIORITY: Record<keyof HanatourEventSourceCounts, number> = {
  location: 6,
  sightseeing: 5,
  section: 4,
  notice: 3,
  meal: 2,
  timeline: 1,
};

function mergeAnchoredEvents(anchored: AnchoredEvent[]): {
  events: DayEvent[];
  sourceCounts: HanatourEventSourceCounts;
} {
  const sourceCounts: HanatourEventSourceCounts = {
    timeline: 0,
    section: 0,
    location: 0,
    sightseeing: 0,
    notice: 0,
    meal: 0,
  };

  anchored.sort((a, b) => {
    const pos = a.anchor.compareDocumentPosition(b.anchor);
    if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return -1;
    if (pos & Node.DOCUMENT_POSITION_PRECEDING) return 1;
    return 0;
  });

  const winners = new Map<string, AnchoredEvent>();
  for (const item of anchored) {
    if (isSkippableTitle(item.event.title ?? "")) continue;
    const key = eventMergeKey(item.event);
    if (!key.trim()) continue;
    const existing = winners.get(key);
    if (!existing || SOURCE_PRIORITY[item.source] > SOURCE_PRIORITY[existing.source]) {
      winners.set(key, item);
    }
  }

  const seen = new Set<string>();
  const merged: DayEvent[] = [];
  let order = 0;

  for (const item of anchored) {
    const key = eventMergeKey(item.event);
    if (!key.trim() || seen.has(key)) continue;
    const winner = winners.get(key);
    if (winner !== item) continue;
    seen.add(key);
    order += 1;
    merged.push({ ...item.event, order });
    sourceCounts[item.source] += 1;
  }

  if (merged.length === 0) {
    return { events: [{ order: 1, title: PLACEHOLDER_EVENT_TITLE }], sourceCounts };
  }
  return { events: merged, sourceCounts };
}

export function parseEventsFromHanatourPanel(
  panel: Element,
  base: string,
): {
  events: DayEvent[];
  parserStrategy: HanatourParserStrategy;
  eventSourceCounts?: HanatourEventSourceCounts;
} {
  const anchored: AnchoredEvent[] = [];

  anchored.push(...extractSectionLabelEvents(panel, base));
  anchored.push(...extractHanatourLocationEvents(panel));
  anchored.push(...extractHanatourSightseeingEvents(panel, base));
  anchored.push(...extractHanatourNoticeEvents(panel, base));
  anchored.push(...extractMealLineEvents(panel));

  const timelineResult = extractEventsFromPanelScope(panel);
  for (const ev of timelineResult.events) {
    anchored.push({ anchor: panel, source: "timeline", event: ev });
  }

  const { events, sourceCounts } = mergeAnchoredEvents(anchored);

  let parserStrategy: HanatourParserStrategy = "merged";
  if (sourceCounts.sightseeing > 0 || sourceCounts.location > 0) {
    parserStrategy = "merged";
  } else if (timelineResult.acceptedCount >= 2) {
    parserStrategy = "timelineCard";
  } else if (sourceCounts.section > 0) {
    parserStrategy = "hanatourCard";
  } else if (events.length === 1 && events[0].title === PLACEHOLDER_EVENT_TITLE) {
    parserStrategy = "lineFallback";
  }

  return { events, parserStrategy, eventSourceCounts: sourceCounts };
}

function parseDayMeta(panel: Element, dayNumber: number): { title?: string; dateText?: string } {
  const headerCandidates = panel.querySelectorAll("h2, h3, h4, h5, strong, [class*='title']");
  for (const el of headerCandidates) {
    const text = (el as HTMLElement).textContent?.trim() ?? "";
    if (!text.includes(`${dayNumber}일차`) && !text.includes("일차")) continue;
    const dateMatch = text.match(DATE_IN_HEADER);
    const title = text
      .replace(/\d+일차/g, "")
      .replace(DATE_IN_HEADER, "")
      .trim();
    return {
      dateText: dateMatch?.[1],
      title: title || undefined,
    };
  }
  const bodyText = getElementText(panel).slice(0, 200);
  const dateMatch = bodyText.match(DATE_IN_HEADER);
  return { dateText: dateMatch?.[1] };
}

async function parseDayPanel(
  panel: Element,
  dayNumber: number,
  base: string,
): Promise<{ day: Day; parserStrategy: HanatourParserStrategy; eventSourceCounts?: HanatourEventSourceCounts }> {
  await expandAccordionsIn(panel);
  const meta = parseDayMeta(panel, dayNumber);
  const { events, parserStrategy, eventSourceCounts } = parseEventsFromHanatourPanel(panel, base);
  const dayImages = extractImagesFromScope(panel, base);
  const assigned = new Set(events.flatMap((e) => e.imageUrls ?? []));
  const dayOnly = dayImages.filter((u) => !assigned.has(u));

  return {
    parserStrategy,
    eventSourceCounts,
    day: {
      dayNumber,
      title: meta.title,
      dateText: meta.dateText,
      imageUrls: dayOnly.length ? dayOnly : undefined,
      events,
    },
  };
}

function buildDebugFromDays(
  days: Day[],
  extra: Partial<NonNullable<HanatourDomItineraryResult["debug"]>>,
): NonNullable<HanatourDomItineraryResult["debug"]> {
  return {
    dayTabsFound: extra.dayTabsFound ?? 0,
    dayTabsClicked: extra.dayTabsClicked ?? 0,
    accordionsExpanded: extra.accordionsExpanded ?? 0,
    eventCountByDay: days.map((d) => d.events?.length ?? 0),
    realEventCountByDay: days.map(
      (d) => d.events?.filter((e) => e.title !== PLACEHOLDER_EVENT_TITLE).length ?? 0,
    ),
    parserStrategies: extra.parserStrategies ?? [],
    eventSourceCountsByDay: extra.eventSourceCountsByDay ?? [],
    extractionPath: extra.extractionPath ?? "tabs",
    ...extra,
  };
}

export type HanatourDomItineraryResult = {
  days: Day[];
  warnings: HanatourImportWarning[];
  debug?: {
    dayTabsFound: number;
    dayTabsClicked: number;
    accordionsExpanded: number;
    eventCountByDay: number[];
    realEventCountByDay?: number[];
    parserStrategies?: HanatourParserStrategy[];
    eventSourceCountsByDay?: HanatourEventSourceCounts[];
    extractionPath?: "tabs" | "accordions" | "tabs+accordions";
  };
};

/** 전체펼침 상태에서 일차 아코디언을 순회해 파싱 */
export async function extractItineraryFromExpandedAccordions(
  doc: Document,
): Promise<HanatourDomItineraryResult> {
  const warnings: HanatourImportWarning[] = [];
  const base = doc.defaultView?.location?.href ?? "https://www.hanatour.com/";
  const entries = findDayAccordionEntries(doc);
  const debug = {
    dayTabsFound: entries.length,
    dayTabsClicked: 0,
    accordionsExpanded: 0,
    eventCountByDay: [] as number[],
    parserStrategies: [] as HanatourParserStrategy[],
    eventSourceCountsByDay: [] as HanatourEventSourceCounts[],
    extractionPath: "accordions" as const,
  };

  if (entries.length === 0) {
    return { days: [], warnings, debug };
  }

  const days: Day[] = [];
  for (const entry of entries) {
    debug.accordionsExpanded += await expandAccordionsIn(entry.panelEl);
    const { day, parserStrategy, eventSourceCounts } = await parseDayPanel(entry.panelEl, entry.dayNumber, base);
    debug.parserStrategies.push(parserStrategy);
    if (eventSourceCounts) debug.eventSourceCountsByDay.push(eventSourceCounts);
    days.push(day);
  }

  return {
    days,
    warnings,
    debug: buildDebugFromDays(days, debug),
  };
}

function pickBetterResult(
  a: HanatourDomItineraryResult,
  b: HanatourDomItineraryResult,
): HanatourDomItineraryResult {
  const aReal = countRealEvents(a.days);
  const bReal = countRealEvents(b.days);
  if (bReal > aReal) return b;
  if (aReal > bReal) return a;
  if (b.days.length > a.days.length) return b;
  return a;
}

/**
 * 여행일정 탭 → 일차 서브탭 순회 → 아코디언 펼침 → 패널 파싱.
 * 탭 경로와 아코디언 경로 중 실이벤트가 많은 결과를 채택.
 */
export async function extractItineraryFromHanatourTabs(
  doc: Document,
): Promise<HanatourDomItineraryResult> {
  const warnings: HanatourImportWarning[] = [];
  const base = doc.defaultView?.location?.href ?? "https://www.hanatour.com/";

  clickMainItineraryTab(doc);
  await sleep(400);
  clickExpandAllItinerary(doc);
  await sleep(400);

  const accordionResult = await extractItineraryFromExpandedAccordions(doc);

  const dayTabs = findDaySubTabs(doc);
  const tabDebug = {
    dayTabsFound: dayTabs.length,
    dayTabsClicked: 0,
    accordionsExpanded: 0,
    eventCountByDay: [] as number[],
    parserStrategies: [] as HanatourParserStrategy[],
    eventSourceCountsByDay: [] as HanatourEventSourceCounts[],
    extractionPath: "tabs" as const,
  };

  if (dayTabs.length === 0) {
    if (accordionResult.days.length === 0) {
      return { days: [], warnings, debug: accordionResult.debug };
    }
    return accordionResult;
  }

  const tabDays: Day[] = [];
  for (const tab of dayTabs) {
    const panel = await activateDayTab(tab, doc);
    if (!panel) continue;
    tabDebug.dayTabsClicked += 1;
    const { day, parserStrategy, eventSourceCounts } = await parseDayPanel(panel, tab.dayNumber, base);
    tabDebug.accordionsExpanded += 1;
    tabDebug.parserStrategies.push(parserStrategy);
    if (eventSourceCounts) tabDebug.eventSourceCountsByDay.push(eventSourceCounts);
    tabDays.push(day);
  }

  const tabResult: HanatourDomItineraryResult = {
    days: tabDays,
    warnings,
    debug: buildDebugFromDays(tabDays, tabDebug),
  };

  if (tabDays.length === 0) {
    if (accordionResult.days.length === 0) {
      warnings.push({
        code: "ITINERARY_DOM_NOT_FOUND",
        message: "일차 서브탭을 찾았으나 패널 파싱에 실패했습니다.",
        path: "itinerary",
      });
    }
    return accordionResult.days.length > 0 ? accordionResult : { days: [], warnings, debug: tabDebug };
  }

  const best = pickBetterResult(tabResult, accordionResult);
  if (best === accordionResult && tabResult.days.length > 0) {
    best.debug = {
      ...best.debug!,
      extractionPath: "tabs+accordions",
      dayTabsFound: Math.max(tabDebug.dayTabsFound, accordionResult.debug?.dayTabsFound ?? 0),
      dayTabsClicked: tabDebug.dayTabsClicked,
    };
  }

  return best;
}

/** 동기 래퍼 — content script에서 await */
export function extractItineraryFromHanatourTabsSync(doc: Document): Promise<HanatourDomItineraryResult> {
  return extractItineraryFromHanatourTabs(doc);
}

export type { HanatourDaySubTab };
