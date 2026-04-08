/**
 * DOM 일정 + 텍스트 파서 일정을 Day 단위로 보수적으로 병합.
 * DOM 이벤트 순서·이미지를 유지하고, 텍스트에만 있는 이벤트만 뒤에 보강.
 */

import type { ModetourImportV1 } from "~types/modetourImport";

export type ItineraryEvent = NonNullable<ModetourImportV1["itinerary"]>["days"][number]["events"][number];
export type ItineraryDay = NonNullable<ModetourImportV1["itinerary"]>["days"][number];

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

/** DOM 전용 placeholder 제거 후 병합 기준 배열 (실제 이벤트가 없을 때는 빈 배열로 텍스트만 채움) */
function domEventsForMerge(domEvents: ItineraryEvent[] | undefined): ItineraryEvent[] {
  const list = domEvents ?? [];
  const withoutPlaceholder = list.filter((e) => e.title !== "(내용 없음)");
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
    if (textEvent.title === "(내용 없음)") continue;
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
    return [{ order: 1, title: "(내용 없음)" }];
  }
  return out;
}

export function shouldSupplementWithText(domDays: ItineraryDay[]): boolean {
  if (!domDays.length) return false;

  const weakDays = domDays.filter((day) => {
    const count = day.events?.length ?? 0;
    if (count <= 1) return true;
    if (day.events?.some((e) => e.title === "(내용 없음)")) return true;
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
      events: textEvs.length ? renumberEvents(textEvs) : [{ order: 1, title: "(내용 없음)" }],
    });
  }

  return merged.sort((a, b) => a.dayNumber - b.dayNumber);
}
