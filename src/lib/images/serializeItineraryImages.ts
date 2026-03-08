/**
 * PR8.10: editor state → 저장 payload 직전 정규화.
 * - 각 event.images에 normalize + dedupe 적용.
 * - event에 배치된 URL은 unassigned에서 제거 (저장 구조에서 event 우선).
 */

import type { ItineraryV2Day, ItineraryStructuredDay } from "@/types/product";
import { normalizeImageUrl } from "./normalizeImageUrl";
import { normalizeEventImages } from "./normalizeEventImages";
import { dedupeEventImages } from "./dedupeEventImages";
import { getEventImageUrl } from "./getEventImageUrl";

export type SerializeItineraryImagesParams = {
  v2Days?: ItineraryV2Day[];
  structuredDays?: ItineraryStructuredDay[];
  unassignedImageUrls: string[];
};

export type SerializeItineraryImagesResult = {
  v2Days: ItineraryV2Day[];
  structuredDays: ItineraryStructuredDay[];
  unassignedImageUrls: string[];
};

function normalizeUnassignedImageUrls(urls: string[]): string[] {
  return urls
    .map((u) => normalizeImageUrl(u))
    .filter(Boolean);
}

function collectPlacedImageUrlSet(params: SerializeItineraryImagesParams): Set<string> {
  const set = new Set<string>();
  (params.v2Days ?? []).forEach((day) => {
    (day.events ?? []).forEach((ev) => {
      (ev.images ?? []).forEach((img) => set.add(getEventImageUrl(img)));
    });
  });
  (params.structuredDays ?? []).forEach((day) => {
    day.events.forEach((ev) => {
      (ev.images ?? []).forEach((img) => set.add(getEventImageUrl(img)));
    });
  });
  return set;
}

function stripUnassignedDuplicatesAgainstEvents(
  urls: string[],
  placedSet: Set<string>,
): string[] {
  const normalized = normalizeUnassignedImageUrls(urls);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const u of normalized) {
    if (placedSet.has(u) || seen.has(u)) continue;
    seen.add(u);
    result.push(u);
  }
  return result;
}

export function serializeItineraryImages(
  params: SerializeItineraryImagesParams,
): SerializeItineraryImagesResult {
  const placedSet = collectPlacedImageUrlSet(params);

  const processV2Days = (days: ItineraryV2Day[]): ItineraryV2Day[] =>
    days.map((day) => ({
      ...day,
      events: (day.events ?? []).map((ev) => {
        const images = ev.images ?? [];
        const normalized = normalizeEventImages(images);
        const deduped = dedupeEventImages(normalized);
        return { ...ev, images: deduped.length > 0 ? deduped : undefined };
      }),
    }));

  const processStructuredDays = (days: ItineraryStructuredDay[]): ItineraryStructuredDay[] =>
    days.map((day) => ({
      ...day,
      events: day.events.map((ev) => {
        const images = ev.images ?? [];
        const normalized = normalizeEventImages(images);
        const deduped = dedupeEventImages(normalized);
        return { ...ev, images: deduped.length > 0 ? deduped : undefined };
      }),
    }));

  const v2Days = processV2Days(params.v2Days ?? []);
  const structuredDays = processStructuredDays(params.structuredDays ?? []);
  const unassignedImageUrls = stripUnassignedDuplicatesAgainstEvents(
    params.unassignedImageUrls ?? [],
    placedSet,
  );

  return { v2Days, structuredDays, unassignedImageUrls };
}
