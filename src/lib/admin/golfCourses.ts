import type { VenueInfoItem } from "@/types/product";

type VenueLike = {
  name?: unknown;
  content?: unknown;
  images?: unknown;
};

function normalizeVenueImages(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of raw) {
    const url = typeof value === "string" ? value.trim() : "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

/**
 * 골프장·호텔 목록 정규화. 이름은 필수이고, 설명이나 사진 중 하나는 있어야 남는다.
 * 사진이 없으면 images 키를 생략해 기존 저장 형태와 같게 유지한다.
 */
export function normalizeVenueInfoList(raw: unknown): VenueInfoItem[] | null {
  if (!Array.isArray(raw)) return null;
  const items: VenueInfoItem[] = [];
  for (const entry of raw) {
    if (entry == null || typeof entry !== "object") continue;
    const item = entry as VenueLike;
    const name = typeof item.name === "string" ? item.name.trim() : "";
    const content = typeof item.content === "string" ? item.content.trim() : "";
    const images = normalizeVenueImages(item.images);
    if (!name || (!content && images.length === 0)) continue;
    items.push(images.length > 0 ? { name, content, images } : { name, content });
  }
  return items.length > 0 ? items : null;
}

export function hasVenueInfoItems(raw: unknown): boolean {
  return normalizeVenueInfoList(raw) != null;
}

export function hasVenueImages(raw: unknown): boolean {
  return (normalizeVenueInfoList(raw) ?? []).some((item) => (item.images?.length ?? 0) > 0);
}

export const normalizeGolfCoursesJson = normalizeVenueInfoList;
export const normalizeHotelsJson = normalizeVenueInfoList;
