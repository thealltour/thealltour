/**
 * PR8.10: event.images 정규화 단일 규칙.
 * - 유효하지 않은/빈 URL 항목 제거, url에 normalizeImageUrl 적용, shape 유지.
 * - sortOrder 연속화(0..n-1), isCover 1개 보장(첫 번째 = 대표). 순서 유지.
 * - dedupe는 하지 않음 → dedupeEventImages에서 수행.
 */

import { getEventImageUrl, type EventImageLike } from "./getEventImageUrl";

export type EventImageInput = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
};

export type EventImageNormalized = {
  url: string;
  alt?: string;
  sortOrder: number;
  isCover: boolean;
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
    withNormalizedUrl.push({
      url,
      alt: obj.alt,
      sortOrder: typeof obj.sortOrder === "number" && Number.isFinite(obj.sortOrder) ? obj.sortOrder : i,
      isCover: obj.isCover === true,
    });
  }

  const sorted = [...withNormalizedUrl].sort((a, b) => a.sortOrder - b.sortOrder);
  let coverAssigned = false;
  const hasAnyCover = sorted.some((i) => i.isCover === true);

  return sorted.map((item, index) => {
    const isCover = hasAnyCover ? item.isCover === true && !coverAssigned : index === 0;
    if (isCover) coverAssigned = true;
    return {
      url: item.url,
      alt: item.alt,
      sortOrder: index,
      isCover,
    };
  });
}
