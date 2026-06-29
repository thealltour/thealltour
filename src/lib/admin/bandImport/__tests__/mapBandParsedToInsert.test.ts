import { describe, expect, it } from "vitest";
import {
  buildBandBookingNotes,
  buildBandDescription,
  mapBandParsedToInsert,
  mapItineraryDaysToV2,
} from "@/lib/admin/bandImport/mapBandParsedToInsert";
import { BAND_IMPORT_PLACEHOLDER_IMAGE } from "@/lib/admin/bandImport/constants";
import type { BandParsedProduct } from "@/lib/admin/bandImport/productParserSchema";

function minimalParsed(overrides: Partial<BandParsedProduct> = {}): BandParsedProduct {
  return {
    title: "제주 3박4일",
    description: "제주 여행 상품",
    band_marketing_copy: null,
    one_liner: null,
    price: 599000,
    duration: "3박4일",
    category: null,
    theme: "제주",
    overview_accommodation: null,
    overview_region: null,
    included_items: "항공+숙박",
    excluded_items: "개인경비",
    booking_notes: null,
    options: null,
    status: "AVAILABLE",
    departure_flight_number: "OZ8123",
    departure_from_airport: "김포",
    departure_to_airport: "제주",
    departure_time: "08:00",
    arrival_time: "09:10",
    seasonal_price_bands: {
      offSeason: "550000",
      weekend: "620000",
      peakSeason: 699000,
    },
    seasonal_price_band_notes: null,
    itinerary_v2_json: [
      {
        day: 1,
        title: "1일차",
        description: "제주 도착 후 렌트카 픽업",
        meals: { breakfast: null, lunch: "흑돼지", dinner: "해산물" },
      },
    ],
    ...overrides,
  };
}

describe("buildBandDescription", () => {
  it("merges description and band_marketing_copy", () => {
    const text = buildBandDescription(
      minimalParsed({
        description: "HWP 요약",
        band_marketing_copy: "🔥 밴드 특가 홍보 문구",
      }),
      "",
      "",
    );
    expect(text).toBe("HWP 요약\n\n🔥 밴드 특가 홍보 문구");
  });
});

describe("buildBandBookingNotes", () => {
  it("appends seasonal band notes to booking notes", () => {
    const notes = buildBandBookingNotes("싱글룸 인/박/4만원", {
      offSeason: "7/1~15 기본가",
      weekend: "목요일 출발 +3만원",
      peakSeason: "7/16~8/30 성수기",
    });
    expect(notes).toContain("싱글룸 인/박/4만원");
    expect(notes).toContain("[비수기] 7/1~15 기본가");
    expect(notes).toContain("[성수기] 7/16~8/30 성수기");
  });
});

describe("mapItineraryDaysToV2", () => {
  it("maps meals and description into events", () => {
    const v2 = mapItineraryDaysToV2(minimalParsed().itinerary_v2_json);
    expect(v2?.days).toHaveLength(1);
    const events = v2?.days[0].events ?? [];
    expect(events.some((e) => e.heading === "중식" && e.description === "흑돼지")).toBe(true);
    expect(events.some((e) => e.heading === "1일차" && e.timeOfDay === "종일")).toBe(true);
  });

  it("preserves transfer duration in description events", () => {
    const v2 = mapItineraryDaysToV2([
      {
        day: 1,
        title: "인천 출발",
        description: "가이드 미팅 06:30, 공항 이동 약 40분",
        meals: { breakfast: null, lunch: null, dinner: null },
      },
    ]);
    const events = v2?.days[0].events ?? [];
    expect(events.some((e) => e.description.includes("약 40분"))).toBe(true);
  });
});

describe("mapBandParsedToInsert", () => {
  it("maps flight fields and seasonal bands to DB columns", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalParsed(),
      bandText: "밴드 본문",
      hwpText: "",
      productSourceUrl: "https://band.us/n/abc",
      imageUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
    });

    expect(payload.title).toBe("제주 3박4일");
    expect(payload.departure_flight_name).toBe("OZ8123");
    expect(payload.departure_from_time).toBe("08:00");
    expect(payload.arrival_to_time).toBe("09:10");
    expect(payload.image_url).toBe("https://example.com/a.jpg");
    expect(payload.images_json).toEqual([
      "https://example.com/a.jpg",
      "https://example.com/b.jpg",
    ]);
    expect(payload.seasonal_price_bands).toEqual({
      offSeason: 550000,
      weekend: 620000,
      peakSeason: 699000,
    });
    expect(payload.price).toBe(599000);
    expect(payload.product_source_url).toBe("https://band.us/n/abc");
    expect(payload.is_active).toBe(true);
  });

  it("maps golf-specific fields", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalParsed({
        category: "골프투어",
        overview_accommodation: "천홍 호텔 또는 동급",
        overview_region: "연태",
        booking_notes: "싱글룸 인/박/4만원",
        band_marketing_copy: "72홀 골프 특가!",
        options: [{ name: "싱글카트 이용", priceText: "인/18홀/2만원" }],
      }),
      bandText: "",
      hwpText: "",
    });

    expect(payload.category).toBe("골프투어");
    expect(payload.overview_accommodation).toBe("천홍 호텔 또는 동급");
    expect(payload.overview_region).toBe("연태");
    expect(payload.booking_notes).toBe("싱글룸 인/박/4만원");
    expect(payload.description).toContain("72홀 골프 특가!");
    expect(payload.options).toMatchObject({
      basePrice: 599000,
      groups: [{ key: "surcharges", items: expect.any(Array) }],
    });
  });

  it("uses placeholder image when imageUrls empty", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalParsed({ price: null }),
      bandText: "",
      hwpText: "HWP 텍스트",
    });
    expect(payload.image_url).toBe(BAND_IMPORT_PLACEHOLDER_IMAGE);
    expect(payload.price).toBe(550000);
  });

  it("dedupes image URLs", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalParsed(),
      bandText: "",
      hwpText: "",
      imageUrls: [" https://x.com/1 ", "https://x.com/1", "https://x.com/2"],
    });
    expect(payload.images_json).toEqual(["https://x.com/1", "https://x.com/2"]);
  });
});
