/**
 * PR8.10: 동일 event 내부 이미지 URL 중복 제거 단일 규칙.
 * - normalizeImageUrl(getEventImageUrl(item)) 기준 첫 등장만 유지, 순서 보존.
 */

import { getEventImageUrl } from "./getEventImageUrl";

export type EventImageItem = {
  url: string;
  alt?: string;
  sortOrder?: number;
  isCover?: boolean;
};

export function dedupeEventImages<T extends EventImageItem>(images: T[]): T[] {
  if (!images?.length) return [];
  const seen = new Set<string>();
  const result: T[] = [];
  for (const img of images) {
    const key = getEventImageUrl(img);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(img);
  }
  return result;
}
