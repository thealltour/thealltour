/**
 * PR8.10: editor state → 저장 payload 직전 정규화.
 * - 각 event.images에 normalize + dedupe 적용.
 * - event에 배치된 URL은 unassigned에서 제거 (저장 구조에서 event 우선).
 * PR-IMAGE-4: 미할당/검수 UX는 관리자 화면에서 처리; 본 함수는 정책 변경 없음.
 */

import type { ItineraryV2Day, ItineraryStructuredDay } from "@/types/product";
import { normalizeImageUrl } from "./normalizeImageUrl";
import { normalizeEventImages } from "./normalizeEventImages";
import { normalizeDayCoverImages } from "./normalizeDayCoverImages";
import { dedupeEventImages } from "./dedupeEventImages";
import { getEventImageUrl } from "./getEventImageUrl";

function isEventImageDeleted(img: unknown): boolean {
  return typeof img === "object" && img != null && (img as { status?: string }).status === "deleted";
}

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
      (ev.images ?? []).forEach((img) => {
        if (isEventImageDeleted(img)) return;
        set.add(getEventImageUrl(img));
      });
    });
  });
  (params.structuredDays ?? []).forEach((day) => {
    day.events.forEach((ev) => {
      (ev.images ?? []).forEach((img) => {
        if (isEventImageDeleted(img)) return;
        set.add(getEventImageUrl(img));
      });
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
    days.map((day) => {
      const cover = normalizeDayCoverImages(day);
      const strippedCover = cover.coverImages.map(
        ({
          status: _st,
          isThumbnailCandidate: _tc,
          isLogoCandidate: _lc,
          isLowResolution: _lr,
          ...rest
        }) => rest,
      );
      return {
        ...day,
        coverImageUrl: cover.coverImageUrl,
        coverImages: strippedCover.length > 0 ? strippedCover : undefined,
        events: (day.events ?? []).map((ev) => {
        const images = (ev.images ?? []).filter((img) => !isEventImageDeleted(img));
        const normalized = normalizeEventImages(images);
        const deduped = dedupeEventImages(normalized);
        const stripped = deduped.map(
          ({
            status: _st,
            isThumbnailCandidate: _tc,
            isLogoCandidate: _lc,
            isLowResolution: _lr,
            ...rest
          }) => rest,
        );
        return { ...ev, images: stripped.length > 0 ? stripped : undefined };
      }),
      };
    });

  const processStructuredDays = (days: ItineraryStructuredDay[]): ItineraryStructuredDay[] =>
    days.map((day) => ({
      ...day,
      events: day.events.map((ev) => {
        const images = (ev.images ?? []).filter((img) => !isEventImageDeleted(img));
        const normalized = normalizeEventImages(images);
        const deduped = dedupeEventImages(normalized);
        const stripped = deduped.map(
          ({
            status: _st,
            isThumbnailCandidate: _tc,
            isLogoCandidate: _lc,
            isLowResolution: _lr,
            ...rest
          }) => rest,
        );
        return { ...ev, images: stripped.length > 0 ? stripped : undefined };
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
