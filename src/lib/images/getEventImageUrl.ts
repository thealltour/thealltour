/**
 * PR8.10: event.images 항목에서 URL 추출 (string | object 공통).
 * 비교 / serialize / hydrate / validation 에서 동일 기준 사용.
 */

import { normalizeImageUrl } from "./normalizeImageUrl";

export type EventImageLike =
  | string
  | { url?: string | null; [key: string]: unknown }
  | null
  | undefined;

export function getEventImageUrl(image: EventImageLike): string {
  if (image == null) return "";
  if (typeof image === "string") return normalizeImageUrl(image);
  const u = image.url;
  return normalizeImageUrl(typeof u === "string" ? u : "");
}

export function hasValidEventImageUrl(image: EventImageLike): boolean {
  const url = getEventImageUrl(image);
  return url.length > 0;
}
