/**
 * DOM 일정 + 텍스트 파서 일정을 Day 단위로 보수적으로 병합.
 */

import type { HanatourImportV1 } from "~types/hanatourImport";

export type ItineraryEvent = NonNullable<HanatourImportV1["itinerary"]>["days"][number]["events"][number];
export type ItineraryDay = NonNullable<HanatourImportV1["itinerary"]>["days"][number];

export const PLACEHOLDER_EVENT_TITLE = "(내용 없음)";

export function isPlaceholderEvent(event: ItineraryEvent): boolean {
  return event.title === PLACEHOLDER_EVENT_TITLE;
}

export function countRealEvents(days: ItineraryDay[]): number {
  return days.reduce(
    (acc, day) => acc + (day.events?.filter((e) => !isPlaceholderEvent(e)).length ?? 0),
    0,
  );
}

export function countRealEventsByDay(days: ItineraryDay[]): number[] {
  return days.map((day) => day.events?.filter((e) => !isPlaceholderEvent(e)).length ?? 0);
}

/** DOM 실이벤트가 충분하거나 텍스트 파서 결과가 과도하면 병합 스킵 */
export function shouldSkipTextMerge(params: {
  domDays: ItineraryDay[];
  textDays: ItineraryDay[];
}): boolean {
  const dayCount = params.domDays.length;
  if (dayCount === 0) return false;

  const realCount = countRealEvents(params.domDays);
  const avgReal = realCount / dayCount;
  if (avgReal >= 2) return true;

  const textTotal = params.textDays.reduce((acc, day) => acc + (day.events?.length ?? 0), 0);
  if (textTotal === 0) return false;

  const textDayCount = Math.max(params.textDays.length, 1);
  const textAvg = textTotal / textDayCount;
  const domAvg = realCount / dayCount;

  if (domAvg > 0 && textAvg > domAvg * 3) return true;
  if (textAvg > 30) return true;

  return false;
}

function normalizeEventText(value?: string): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

export function buildEventMergeKey(event: ItineraryEvent): string {
  const title = normalizeEventText(event.title);
  const time = normalizeEventText(event.timeText);
  return `${time}__${title}`;
}

function isSimilarEvent(a: ItineraryEvent, b: ItineraryEvent): boolean {
  const aTitle = normalizeEventText(a.title);
  const bTitle = normalizeEventText(b.title);

  if (!aTitle || !bTitle) return false;

  if (aTitle === bTitle) return true;
  if (aTitle.includes(bTitle) || bTitle.includes(aTitle)) return true;

  const aTime = normalizeEventText(a.timeText);
  const bTime = normalizeEventText(b.timeText);

  if (aTime && bTime && aTime === bTime && (aTitle.includes(bTitle) || bTitle.includes(aTitle))) {
    return true;
  }

  return false;
}

function renumberEvents(events: ItineraryEvent[]): ItineraryEvent[] {
  return events.map((e, index) => ({ ...e, order: index + 1 }));
}

function domEventsForMerge(domEvents: ItineraryEvent[] | undefined): ItineraryEvent[] {
  const list = domEvents ?? [];
  const withoutPlaceholder = list.filter((e) => !isPlaceholderEvent(e));
  return withoutPlaceholder.length > 0 ? [...withoutPlaceholder] : [];
}

function mergeDayEvents(
  dayNumber: number,
  domEvents: ItineraryEvent[],
  textEvents: ItineraryEvent[],
): ItineraryEvent[] {
  const merged = domEventsForMerge(domEvents);
  const existingKeys = new Set(merged.map(buildEventMergeKey).filter((k) => k.length > 0));

  for (const textEvent of textEvents) {
    if (isPlaceholderEvent(textEvent)) continue;
    const key = buildEventMergeKey(textEvent);
    if (!key.trim()) continue;
    if (existingKeys.has(key)) continue;

    const similar = merged.find((d) => isSimilarEvent(d, textEvent));

    if (similar) {
      if (!similar.descriptionText?.trim() && textEvent.descriptionText?.trim()) {
        similar.descriptionText = textEvent.descriptionText;
      }
      existingKeys.add(key);
      continue;
    }

    merged.push({
      ...textEvent,
      order: 0,
      imageUrls: undefined,
    });
    existingKeys.add(key);

    if (typeof console !== "undefined" && console.log) {
      console.log("[ITINERARY][MERGE_APPEND_EVENT]", {
        dayNumber,
        title: textEvent.title,
      });
    }
  }

  const out = renumberEvents(merged);
  if (out.length === 0) {
    return [{ order: 1, title: PLACEHOLDER_EVENT_TITLE }];
  }
  return out;
}

export function shouldSupplementWithText(domDays: ItineraryDay[]): boolean {
  if (!domDays.length) return false;

  const weakDays = domDays.filter((day) => {
    const count = day.events?.length ?? 0;
    if (count <= 1) return true;
    if (day.events?.some((e) => isPlaceholderEvent(e))) return true;
    const evs = day.events ?? [];
    const titleOnly = evs.filter(
      (e) => !!(e.title?.trim() && !e.descriptionText?.trim() && !(e.imageUrls?.length)),
    ).length;
    if (evs.length >= 2 && titleOnly / evs.length >= 0.7) return true;
    return false;
  });

  return weakDays.length >= Math.ceil(domDays.length / 2);
}

export function mergeDomAndTextDays(params: {
  domDays: ItineraryDay[];
  textDays: ItineraryDay[];
}): ItineraryDay[] {
  const textDayMap = new Map<number, ItineraryDay>();
  for (const day of params.textDays) {
    textDayMap.set(day.dayNumber, day);
  }

  const merged: ItineraryDay[] = [];

  for (const domDay of params.domDays) {
    const textDay = textDayMap.get(domDay.dayNumber);
    const nextEvents = mergeDayEvents(domDay.dayNumber, domDay.events ?? [], textDay?.events ?? []);

    if (typeof console !== "undefined" && console.log) {
      console.log("[ITINERARY][MERGE_DAY]", {
        dayNumber: domDay.dayNumber,
        domEventCount: domDay.events?.length ?? 0,
        textEventCount: textDay?.events?.length ?? 0,
        mergedEventCount: nextEvents.length,
      });
    }

    merged.push({
      ...domDay,
      title: domDay.title || textDay?.title,
      dateText: domDay.dateText || textDay?.dateText,
      descriptionText: domDay.descriptionText || textDay?.descriptionText,
      imageUrls: domDay.imageUrls?.length ? domDay.imageUrls : textDay?.imageUrls,
      events: nextEvents,
    });

    textDayMap.delete(domDay.dayNumber);
  }

  for (const [, textOnlyDay] of textDayMap) {
    const textEvs = textOnlyDay.events ?? [];
    merged.push({
      ...textOnlyDay,
      events: textEvs.length ? renumberEvents(textEvs) : [{ order: 1, title: PLACEHOLDER_EVENT_TITLE }],
    });
  }

  return merged.sort((a, b) => a.dayNumber - b.dayNumber);
}
