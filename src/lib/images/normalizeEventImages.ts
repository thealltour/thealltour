/**
 * PR8.10: event.images 정규화 단일 규칙.
 * - 유효하지 않은/빈 URL 항목 제거, url에 normalizeImageUrl 적용, shape 유지.
 * - sortOrder 연속화(0..n-1), isCover 1개 보장(첫 번째 = 대표). 순서 유지.
 * - dedupe는 하지 않음 → dedupeEventImages에서 수행.
 */

import { getEventImageUrl, type EventImageLike } from "./getEventImageUrl";

export const MAX_ITINERARY_EVENT_IMAGES = 10;

export type EventImageInput = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
  status?: "active" | "deleted" | "unassigned";
  isThumbnailCandidate?: boolean;
  isLogoCandidate?: boolean;
  isLowResolution?: boolean;
};

export type EventImageNormalized = {
  url: string;
  alt?: string;
  sortOrder: number;
  isCover: boolean;
  status?: "active" | "deleted" | "unassigned";
  isThumbnailCandidate?: boolean;
  isLogoCandidate?: boolean;
  isLowResolution?: boolean;
};

/**
 * 입력 배열에서 유효한 항목만 남기고 url 정규화 후, sortOrder 정렬·연속 할당 및 isCover 1개 보장.
 */
export function normalizeEventImages(
  images: EventImageInput[] | EventImageLike[] | undefined | null,
): EventImageNormalized[] {
  if (!images || !Array.isArray(images) || images.length === 0) return [];

  const withNormalizedUrl: EventImageNormalized[] = [];
  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const url = getEventImageUrl(item);
    if (!url) continue;
    const obj = typeof item === "object" && item !== null && !Array.isArray(item)
      ? (item as EventImageInput)
      : { url };
    const row: EventImageNormalized = {
      url,
      alt: obj.alt,
      sortOrder: typeof obj.sortOrder === "number" && Number.isFinite(obj.sortOrder) ? obj.sortOrder : i,
      isCover: obj.isCover === true,
    };
    if (obj.status != null) row.status = obj.status;
    if (typeof obj.isThumbnailCandidate === "boolean") row.isThumbnailCandidate = obj.isThumbnailCandidate;
    if (typeof obj.isLogoCandidate === "boolean") row.isLogoCandidate = obj.isLogoCandidate;
    if (typeof obj.isLowResolution === "boolean") row.isLowResolution = obj.isLowResolution;
    withNormalizedUrl.push(row);
  }

  const sorted = [...withNormalizedUrl].sort((a, b) => a.sortOrder - b.sortOrder);
  let coverAssigned = false;
  const hasAnyCover = sorted.some((i) => i.isCover === true);

  return sorted.map((item, index) => {
    const isCover = hasAnyCover ? item.isCover === true && !coverAssigned : index === 0;
    if (isCover) coverAssigned = true;
    const out: EventImageNormalized = {
      url: item.url,
      alt: item.alt,
      sortOrder: index,
      isCover,
    };
    if (item.status != null) out.status = item.status;
    if (typeof item.isThumbnailCandidate === "boolean") out.isThumbnailCandidate = item.isThumbnailCandidate;
    if (typeof item.isLogoCandidate === "boolean") out.isLogoCandidate = item.isLogoCandidate;
    if (typeof item.isLowResolution === "boolean") out.isLowResolution = item.isLowResolution;
    return out;
  }).slice(0, MAX_ITINERARY_EVENT_IMAGES);
}
