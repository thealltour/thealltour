import { describe, expect, it } from "vitest";
import {
  detectExternalProvider,
  getExternalProviderLabel,
} from "@/lib/admin/externalImport/detectExternalProvider";
import {
  mapExternalParsedToInsert,
  summarizeExternalParsedForResponse,
} from "@/lib/admin/externalImport/mapExternalParsedToInsert";
import { mergeExternalImport } from "@/lib/admin/externalImport/mergeExternalImport";
import { BAND_IMPORT_PLACEHOLDER_IMAGE } from "@/lib/admin/bandImport/constants";
import type { ExternalParsedMeta } from "@/lib/admin/externalImport/externalProductMetaSchema";
import type { ItineraryBlock } from "@/lib/admin/externalImport/itineraryBlockTypes";

describe("detectExternalProvider", () => {
  it("detects hanatour", () => {
    expect(detectExternalProvider("https://www.hanatour.com/trp/pkg/ABC")).toBe("hanatour");
    expect(getExternalProviderLabel("hanatour")).toBe("하나투어");
  });

  it("detects modetour", () => {
    expect(detectExternalProvider("https://www.modetour.com/package/123")).toBe("modetour");
  });

  it("returns null for unknown", () => {
    expect(detectExternalProvider("https://example.com")).toBeNull();
  });
});

function minimalMeta(overrides: Partial<ExternalParsedMeta> = {}): ExternalParsedMeta {
  return {
    title: "동남아 5일",
    description: "패키지 여행",
    price: 1290000,
    duration: "3박5일",
    theme: "동남아",
    included_items: "항공+숙박",
    excluded_items: "개인경비",
    booking_notes: null,
    status: "AVAILABLE",
    departure_flight_number: "OZ701",
    departure_from_airport: "인천",
    departure_to_airport: "방콕",
    departure_time: "09:00",
    arrival_time: "13:30",
    ...overrides,
  };
}

const RICH_BLOCKS: ItineraryBlock[] = [
  {
    day: 2,
    heading: "상비산",
    description: "상비산 관광 상세 설명",
    imageUrls: [
      "https://cdn.example.com/sangbishan-1.jpg",
      "https://cdn.example.com/sangbishan-2.jpg",
    ],
    kind: "sightseeing",
  },
  {
    day: 2,
    heading: "첩채산",
    description: "첩채산 일몰",
    imageUrls: ["https://cdn.example.com/diecai-1.jpg"],
    kind: "sightseeing",
  },
];

describe("mapExternalParsedToInsert", () => {
  it("maps flight fields and deterministic gallery", () => {
    const parsed = mergeExternalImport({
      meta: minimalMeta(),
      productGalleryUrls: Array.from({ length: 9 }, (_, i) => `https://cdn.example.com/g${i}.jpg`),
      heroImageUrl: "https://cdn.example.com/g0.jpg",
      itineraryBlocks: RICH_BLOCKS,
    });

    const payload = mapExternalParsedToInsert({
      parsed,
      productSourceUrl: "https://www.hanatour.com/trp/pkg/X",
      provider: "hanatour",
    });

    expect(payload.departure_flight_name).toBe("OZ701");
    expect(payload.category).toBe("하나투어");
    expect(payload.images_json).toHaveLength(9);
    expect(payload.image_url).toBe("https://cdn.example.com/g0.jpg");

    const itinerary = payload.itinerary_v2_json as {
      days: { events: { heading: string; images?: { url: string }[] }[] }[];
    };
    expect(itinerary.days[0].events).toHaveLength(2);
    expect(itinerary.days[0].events[0].images).toHaveLength(2);
  });

  it("uses placeholder when no images", () => {
    const parsed = mergeExternalImport({
      meta: minimalMeta(),
      itineraryBlocks: [],
    });
    const payload = mapExternalParsedToInsert({
      parsed,
      provider: "modetour",
    });
    expect(payload.image_url).toBe(BAND_IMPORT_PLACEHOLDER_IMAGE);
    expect(payload.category).toBe("모두투어");
  });

  it("summarizes gallery and event counts", () => {
    const parsed = mergeExternalImport({
      meta: minimalMeta(),
      productGalleryUrls: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.jpg"],
      itineraryBlocks: RICH_BLOCKS,
    });
    const summary = summarizeExternalParsedForResponse(parsed);
    expect(summary.galleryCount).toBe(2);
    expect(summary.itineraryEventCount).toBe(2);
    expect(summary.itineraryImageCount).toBeGreaterThanOrEqual(3);
  });
});
