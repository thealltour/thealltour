import type { Product } from "@/types/product";
import { getEventImageUrl } from "./getEventImageUrl";
import type { ProductImageEntry } from "./imageDownload.types";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";

function allocateEntryId(
  usedIds: Set<string>,
  partial: Omit<ProductImageEntry, "id" | "url"> & { url: string },
): string {
  const d = partial.dayNumber ?? "na";
  const ev = partial.eventIndex ?? "na";
  const ii = partial.imageIndexInEvent ?? "na";
  const base = `${partial.source}-${d}-${ev}-${partial.index}-${ii}`;
  let id = base;
  let suf = 0;
  while (usedIds.has(id)) {
    suf += 1;
    id = `${base}__${suf}`;
  }
  usedIds.add(id);
  return id;
}

function addIfNew(map: Map<string, ProductImageEntry>, partial: Omit<ProductImageEntry, "id">): void {
  const url = normalizeProductImageUrl(partial.url);
  if (!url || map.has(url)) return;
  const usedIds = new Set(Array.from(map.values(), (e) => e.id));
  const id = allocateEntryId(usedIds, partial);
  map.set(url, { ...partial, id, url });
}

/**
 * 상품에 연결된 이미지 URL을 출처 메타와 함께 수집합니다.
 * 동일 URL은 첫 번째로 만난 엔트리만 유지합니다.
 */
export function collectProductImageEntries(product: Product): ProductImageEntry[] {
  const map = new Map<string, ProductImageEntry>();
  let seq = 0;

  const t = (u: string | null | undefined) => (typeof u === "string" ? u.trim() : "");

  const coverUrl = t(product.image_url);
  if (coverUrl) {
    addIfNew(map, { url: coverUrl, source: "cover", index: 0 });
  }

  if (Array.isArray(product.images_json)) {
    product.images_json.forEach((u, i) => {
      const url = t(u);
      if (!url) return;
      addIfNew(map, { url, source: "gallery", index: i });
    });
  }

  if (product.itinerary_media_json) {
    const entries = Object.entries(product.itinerary_media_json).sort(([a], [b]) => {
      const na = Number.parseInt(a, 10);
      const nb = Number.parseInt(b, 10);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b);
    });
    entries.forEach(([key, u]) => {
      const url = t(u);
      if (!url) return;
      const dayParsed = Number.parseInt(key, 10);
      addIfNew(map, {
        url,
        source: "itinerary-media",
        index: seq++,
        dayNumber: Number.isFinite(dayParsed) ? dayParsed : undefined,
      });
    });
  }

  if (Array.isArray(product.itinerary_days_json)) {
    product.itinerary_days_json.forEach((day) => {
      const dayNum = day.day;
      const cover = t(day.coverImageUrl ?? undefined);
      if (cover) {
        addIfNew(map, {
          url: cover,
          source: "structured-day-cover",
          index: seq++,
          dayNumber: dayNum,
        });
      }
      day.events?.forEach((ev, eventIndex) => {
        const imgs = ev.images ?? [];
        imgs.forEach((img, imgIdx) => {
          const url = getEventImageUrl(img);
          if (!url) return;
          addIfNew(map, {
            url,
            source: "structured-event-image",
            index: seq++,
            dayNumber: dayNum,
            eventIndex,
            imageIndexInEvent: imgIdx + 1,
            eventHeading: ev.heading,
          });
        });
      });
    });
  }

  if (product.itinerary_v2_json?.days) {
    product.itinerary_v2_json.days.forEach((day) => {
      const dayNum = day.day;
      const coverImages = day.coverImages ?? [];
      if (coverImages.length > 0) {
        coverImages.forEach((img, imgIdx) => {
          const url = getEventImageUrl(img);
          if (!url) return;
          addIfNew(map, {
            url,
            source: "v2-day-cover",
            index: seq++,
            dayNumber: dayNum,
            imageIndexInEvent: imgIdx + 1,
          });
        });
      } else {
        const cover = t(day.coverImageUrl);
        if (cover) {
          addIfNew(map, {
            url: cover,
            source: "v2-day-cover",
            index: seq++,
            dayNumber: dayNum,
          });
        }
      }
      day.events?.forEach((ev, eventIndex) => {
        const imgs = ev.images ?? [];
        imgs.forEach((img, imgIdx) => {
          const url = getEventImageUrl(img);
          if (!url) return;
          addIfNew(map, {
            url,
            source: "v2-event-image",
            index: seq++,
            dayNumber: dayNum,
            eventIndex,
            imageIndexInEvent: imgIdx + 1,
            eventHeading: ev.heading,
          });
        });
      });
    });
  }

  const catalog = product.package_catalog_json;
  if (catalog) {
    for (const item of catalog.attractions ?? []) {
      for (const raw of item.imageUrls ?? []) {
        const url = t(raw);
        if (!url) continue;
        addIfNew(map, { url, source: "catalog", index: seq++ });
      }
    }
    for (const item of catalog.optionalTours ?? []) {
      for (const raw of item.imageUrls ?? []) {
        const url = t(raw);
        if (!url) continue;
        addIfNew(map, { url, source: "catalog", index: seq++ });
      }
    }
  }

  const overviewCover = t(product.overview_json?.coverImageUrl);
  if (overviewCover) {
    addIfNew(map, { url: overviewCover, source: "overview-cover", index: seq++ });
  }

  return Array.from(map.values());
}
