import type { ItineraryEventImage } from "@/types/product";
import {
  MAX_ITINERARY_EVENT_IMAGES,
  normalizeEventImages,
  type EventImageNormalized,
} from "./normalizeEventImages";

export { MAX_ITINERARY_EVENT_IMAGES };

export type DayCoverImagesNormalized = {
  coverImages: EventImageNormalized[];
  coverImageUrl?: string;
};

export function normalizeDayCoverImages(input: {
  coverImageUrl?: string | null;
  coverImages?: ItineraryEventImage[] | null;
}): DayCoverImagesNormalized {
  let coverImages = normalizeEventImages(input.coverImages);
  if (coverImages.length === 0 && input.coverImageUrl?.trim()) {
    coverImages = normalizeEventImages([{ url: input.coverImageUrl.trim(), isCover: true }]);
  }
  const coverImageUrl =
    coverImages.find((img) => img.isCover)?.url ?? coverImages[0]?.url ?? undefined;
  return {
    coverImages: coverImages.slice(0, MAX_ITINERARY_EVENT_IMAGES),
    coverImageUrl,
  };
}
