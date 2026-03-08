/**
 * PR8.10: 저장/로드 데이터 → editor state 복원 시 이미지 정규화.
 * - hydrate(serialize(editorState)) ≈ editorState (의미적으로 동일).
 */

import type { ItineraryV2Day, ItineraryStructuredDay } from "@/types/product";
import { normalizeEventImages } from "./normalizeEventImages";
import { dedupeEventImages } from "./dedupeEventImages";
import { getEventImageUrl } from "./getEventImageUrl";
import { normalizeImageUrl } from "./normalizeImageUrl";

export type HydrateItineraryImagesParams = {
  v2Days?: ItineraryV2Day[] | null;
  structuredDays?: ItineraryStructuredDay[] | null;
  unassignedImageUrls?: string[] | null;
};

export type HydrateItineraryImagesResult = {
  v2Days: ItineraryV2Day[];
  structuredDays: ItineraryStructuredDay[];
  unassignedImageUrls: string[];
};

function collectPlacedUrlSet(
  v2Days: ItineraryV2Day[],
  structuredDays: ItineraryStructuredDay[],
): Set<string> {
  const set = new Set<string>();
  v2Days.forEach((day) => {
    (day.events ?? []).forEach((ev) => {
      (ev.images ?? []).forEach((img) => set.add(getEventImageUrl(img)));
    });
  });
  structuredDays.forEach((day) => {
    day.events.forEach((ev) => {
      (ev.images ?? []).forEach((img) => set.add(getEventImageUrl(img)));
    });
  });
  return set;
}

export function hydrateItineraryImages(
  params: HydrateItineraryImagesParams,
): HydrateItineraryImagesResult {
  const v2Days = params.v2Days ?? [];
  const structDays = params.structuredDays ?? [];

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

  const outV2 = processV2Days(Array.isArray(v2Days) ? v2Days : []);
  const outStruct = processStructuredDays(Array.isArray(structDays) ? structDays : []);

  const placedSet = collectPlacedUrlSet(outV2, outStruct);
  const rawUnassigned = Array.isArray(params.unassignedImageUrls) ? params.unassignedImageUrls : [];
  const normalizedUnassigned = rawUnassigned.map((u) => normalizeImageUrl(u)).filter(Boolean);
  const seen = new Set<string>();
  const unassignedImageUrls: string[] = [];
  for (const u of normalizedUnassigned) {
    if (placedSet.has(u) || seen.has(u)) continue;
    seen.add(u);
    unassignedImageUrls.push(u);
  }

  return {
    v2Days: outV2,
    structuredDays: outStruct,
    unassignedImageUrls,
  };
}
