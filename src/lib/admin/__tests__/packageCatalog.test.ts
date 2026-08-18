import { describe, expect, it } from "vitest";
import {
  hasPackageCatalogContent,
  normalizePackageCatalog,
  optionalToursToPlainText,
} from "@/lib/admin/packageCatalog";

describe("normalizePackageCatalog", () => {
  it("keeps allowed keys and drops extras", () => {
    const result = normalizePackageCatalog({
      hotels: [{ name: "로열 퍼시픽 호텔", extra: true }],
      attractions: [
        {
          name: "오페라하우스",
          description: "시드니 랜드마크",
          imageUrls: ["https://image.hanatour.com/a.jpg", "data:image/png;base64,xx"],
          html: "<div/>",
        },
      ],
      optionalTours: [
        {
          name: "시드니 야경 투어",
          description: "워킹투어",
          priceText: "성인 AUD 70",
          included: false,
          imageUrls: ["https://image.hanatour.com/tour.jpg"],
        },
      ],
      referenceNotes: "  ETA 비자 개별 발급  ",
      reviews: "후기는 버림",
    });

    expect(result).toEqual({
      hotels: [{ name: "로열 퍼시픽 호텔" }],
      attractions: [
        {
          name: "오페라하우스",
          description: "시드니 랜드마크",
          imageUrls: ["https://image.hanatour.com/a.jpg"],
        },
      ],
      optionalTours: [
        {
          name: "시드니 야경 투어",
          description: "워킹투어",
          priceText: "성인 AUD 70",
          included: false,
          imageUrls: ["https://image.hanatour.com/tour.jpg"],
        },
      ],
      referenceNotes: "ETA 비자 개별 발급",
    });
    expect(result && "reviews" in result).toBe(false);
    expect(result?.hotels[0] && "extra" in result.hotels[0]).toBe(false);
  });

  it("returns null when empty", () => {
    expect(normalizePackageCatalog({ hotels: [], attractions: [], optionalTours: [] })).toBeNull();
    expect(normalizePackageCatalog(null)).toBeNull();
  });
});

describe("hasPackageCatalogContent", () => {
  it("is true only when a catalog slot has content", () => {
    expect(hasPackageCatalogContent(null)).toBe(false);
    expect(
      hasPackageCatalogContent({ hotels: [], attractions: [], optionalTours: [] }),
    ).toBe(false);
    expect(
      hasPackageCatalogContent({
        hotels: [{ name: "로열 퍼시픽 호텔" }],
        attractions: [],
        optionalTours: [],
      }),
    ).toBe(true);
  });
});

describe("optionalToursToPlainText", () => {
  it("joins names and prices for optional_tours fallback", () => {
    expect(
      optionalToursToPlainText({
        hotels: [],
        attractions: [],
        optionalTours: [
          { name: "야경 투어", description: "", priceText: "AUD 70", imageUrls: [] },
          { name: "크루즈", description: "", included: true, imageUrls: [] },
        ],
      }),
    ).toBe("야경 투어 — AUD 70\n크루즈 — 상품 포함");
  });
});
