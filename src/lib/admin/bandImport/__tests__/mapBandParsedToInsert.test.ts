import { describe, expect, it } from "vitest";
import {
  buildBandBookingNotes,
  buildBandDescription,
  mapBandParsedToInsert,
  mapItineraryDaysToV2,
} from "@/lib/admin/bandImport/mapBandParsedToInsert";
import { BAND_IMPORT_PLACEHOLDER_IMAGE } from "@/lib/admin/bandImport/constants";
import { minimalBandParsed } from "@/lib/admin/bandImport/__tests__/bandParsedFixtures";

describe("buildBandDescription", () => {
  it("merges description and band_marketing_copy", () => {
    const text = buildBandDescription(
      minimalBandParsed({
        description: "HWP 요약",
        band_marketing_copy: "🔥 밴드 특가 홍보 문구",
      }),
      "",
      "",
    );
    expect(text).toBe("HWP 요약\n\n🔥 밴드 특가 홍보 문구");
  });

  it("uses full hwp+band text fallback without truncation", () => {
    const longHwp = "H".repeat(600);
    const longBand = "B".repeat(400);
    const text = buildBandDescription(minimalBandParsed({ description: null, band_marketing_copy: null }), longBand, longHwp);
    expect(text).toHaveLength(600 + 2 + 400);
    expect(text.startsWith(longHwp)).toBe(true);
  });
});

describe("buildBandBookingNotes", () => {
  it("appends seasonal band notes to booking notes", () => {
    const notes = buildBandBookingNotes("싱글룸 인/박/4만원", {
      offSeason: "7/1~15 기본가",
      weekend: "목요일 출발 +3만원",
      peakSeason: "7/16~8~30 성수기",
    });
    expect(notes).toContain("싱글룸 인/박/4만원");
    expect(notes).toContain("[비수기] 7/1~15 기본가");
    expect(notes).toContain("[성수기] 7/16~8~30 성수기");
  });
});

describe("mapItineraryDaysToV2", () => {
  it("maps meals and description into events", () => {
    const v2 = mapItineraryDaysToV2(minimalBandParsed().itinerary_v2_json);
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
      parsed: minimalBandParsed(),
      bandText: "밴드 본문",
      hwpText: "",
      productSourceUrl: "https://band.us/n/abc",
      imageUrls: ["https://example.com/a.jpg", "https://example.com/b.jpg"],
    });

    expect(payload.title).toBe("제주 3박4일");
    expect(payload.departure_flight_name).toBe("OZ8123");
    expect(payload.departure_from_time).toBe("08:00");
    expect(payload.arrival_to_time).toBe("10:20");
    expect(payload.arrival_flight_name).toBe("OZ8124");
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

  it("maps expanded meta fields", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalBandParsed({
        optional_expenses: "[숙박] 싱글룸 4만원",
        optional_tours: "스노클링 5만원",
        selling_points_json: {
          corePoints: "핵심포인트 원문",
          tourism: null,
          meals: "식사 안내",
          transport: null,
          insurance: null,
        },
        travel_notes: "여행 유의사항",
        meta_title: "제주 골프",
        point_tourism: "O",
        airline_name: "제주항공",
      }),
      bandText: "",
      hwpText: "",
    });

    expect(payload.optional_expenses).toBe("[숙박] 싱글룸 4만원");
    expect(payload.optional_tours).toBe("스노클링 5만원");
    expect(payload.selling_points_json).toEqual({
      corePoints: "핵심포인트 원문",
      meals: "식사 안내",
    });
    expect(payload.travel_notes).toBe("여행 유의사항");
    expect(payload.meta_title).toBe("제주 골프");
    expect(payload.point_tourism).toBe("O");
    expect(payload.meta_info).toBe("제주항공 OZ8123");
  });

  it("maps golf-specific fields", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalBandParsed({
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
      parsed: minimalBandParsed({ price: null }),
      bandText: "",
      hwpText: "HWP 텍스트",
    });
    expect(payload.image_url).toBe(BAND_IMPORT_PLACEHOLDER_IMAGE);
    expect(payload.price).toBe(550000);
  });

  it("dedupes image URLs", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalBandParsed(),
      bandText: "",
      hwpText: "",
      imageUrls: [" https://x.com/1 ", "https://x.com/1", "https://x.com/2"],
    });
    expect(payload.images_json).toEqual(["https://x.com/1", "https://x.com/2"]);
  });

  it("maps departure schedules to json column and uses lowest schedule price", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalBandParsed({
        price: 999000,
        departure_schedules: [
          {
            departure_date: "2025.07.23(수)",
            return_date: null,
            price: 890000,
            label: "7/23(수)",
            status: "AVAILABLE",
          },
          {
            departure_date: "2025-07-30",
            return_date: null,
            price: 920000,
            label: null,
            status: null,
          },
        ],
        departure_from_date: null,
      }),
      bandText: "",
      hwpText: "",
    });

    expect(payload.departure_schedules_json).toEqual([
      {
        departureDate: "2025-07-23",
        returnDate: null,
        price: 890000,
        label: "7/23(수)",
        status: "AVAILABLE",
      },
      {
        departureDate: "2025-07-30",
        returnDate: null,
        price: 920000,
        label: null,
        status: null,
      },
    ]);
    expect(payload.price).toBe(890000);
    expect(payload.departure_from_date).toBe("2025-07-23");
  });

  it("normalizes month/day-only departure schedules using context year", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalBandParsed({
        price: 999000,
        departure_schedules: [
          {
            departure_date: "7/23(수)",
            return_date: null,
            price: 890000,
            label: "7/23(수)",
            status: "AVAILABLE",
          },
          {
            departure_date: "7/30(수)",
            return_date: null,
            price: 920000,
            label: "7/30(수)",
            status: null,
          },
        ],
        departure_from_date: null,
      }),
      bandText: "2026년 여름 골프투어",
      hwpText: "",
    });

    expect(payload.departure_schedules_json).toEqual([
      {
        departureDate: "2026-07-23",
        returnDate: null,
        price: 890000,
        label: "7/23(수)",
        status: "AVAILABLE",
      },
      {
        departureDate: "2026-07-30",
        returnDate: null,
        price: 920000,
        label: "7/30(수)",
        status: null,
      },
    ]);
    expect(payload.price).toBe(890000);
    expect(payload.departure_from_date).toBe("2026-07-23");
  });
});
