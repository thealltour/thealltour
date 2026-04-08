import type { ItineraryV2Day } from "@/types/product";
import type { ModetourImageHeuristicHints } from "@/types/modetourImport";

/**
 * 재호스팅 후 URL과 맞춘 imageHintsByUrl을 이벤트 이미지 항목에 병합하고 status 기본값을 둡니다.
 */
export function mergeModetourImageHintsIntoV2Days(
  days: ItineraryV2Day[],
  hints?: Record<string, ModetourImageHeuristicHints> | null,
): ItineraryV2Day[] {
  return days.map((d) => ({
    ...d,
    events: (d.events ?? []).map((ev) => ({
      ...ev,
      images: (ev.images ?? []).map((img) => {
        const url = typeof img.url === "string" ? img.url.trim() : "";
        const h = url && hints ? hints[url] : undefined;
        return {
          ...img,
          status: img.status ?? "active",
          ...(h
            ? {
                isThumbnailCandidate: h.isThumbnailCandidate,
                isLogoCandidate: h.isLogoCandidate,
                isLowResolution: h.isLowResolution,
              }
            : {}),
        };
      }),
    })),
  }));
}
