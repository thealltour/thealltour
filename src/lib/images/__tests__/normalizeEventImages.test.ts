import { describe, expect, it } from "vitest";
import {
  MAX_ITINERARY_EVENT_IMAGES,
  normalizeEventImages,
} from "@/lib/images/normalizeEventImages";
import { normalizeDayCoverImages } from "@/lib/images/normalizeDayCoverImages";

describe("normalizeEventImages", () => {
  it("caps images at MAX_ITINERARY_EVENT_IMAGES", () => {
    const input = Array.from({ length: 12 }, (_, i) => ({
      url: `https://example.com/${i}.jpg`,
      sortOrder: i,
    }));
    const result = normalizeEventImages(input);
    expect(result).toHaveLength(MAX_ITINERARY_EVENT_IMAGES);
    expect(result[0]?.isCover).toBe(true);
  });

  it("preserves internal newlines in alt text", () => {
    const result = normalizeEventImages([
      { url: "https://example.com/a.jpg", alt: "line1\nline2" },
    ]);
    expect(result[0]?.alt).toBe("line1\nline2");
  });
});

describe("normalizeDayCoverImages", () => {
  it("migrates legacy coverImageUrl to coverImages", () => {
    const result = normalizeDayCoverImages({
      coverImageUrl: "https://example.com/day.jpg",
    });
    expect(result.coverImages).toHaveLength(1);
    expect(result.coverImages[0]?.url).toBe("https://example.com/day.jpg");
    expect(result.coverImages[0]?.isCover).toBe(true);
    expect(result.coverImageUrl).toBe("https://example.com/day.jpg");
  });

  it("syncs coverImageUrl from coverImages representative", () => {
    const result = normalizeDayCoverImages({
      coverImages: [
        { url: "https://example.com/1.jpg", isCover: false },
        { url: "https://example.com/2.jpg", isCover: true },
      ],
    });
    expect(result.coverImageUrl).toBe("https://example.com/2.jpg");
    expect(result.coverImages.find((i) => i.isCover)?.url).toBe("https://example.com/2.jpg");
  });
});
