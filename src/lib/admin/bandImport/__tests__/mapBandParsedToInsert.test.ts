import { describe, expect, it, vi } from "vitest";
import {
  buildBandBookingNotes,
  buildBandDescription,
  hasExplicitYearInBandSource,
  inferBandScheduleDefaultYear,
  mapBandParsedToInsert,
  mapItineraryDaysToV2,
} from "@/lib/admin/bandImport/mapBandParsedToInsert";
import { BAND_IMPORT_PLACEHOLDER_IMAGE } from "@/lib/admin/bandImport/constants";
import { minimalBandParsed } from "@/lib/admin/bandImport/__tests__/bandParsedFixtures";

describe("buildBandDescription", () => {
  it("puts band_marketing_copy before HWP description", () => {
    const text = buildBandDescription(
      minimalBandParsed({
        description: "HWP 요약",
        band_marketing_copy: "🔥 밴드 특가 홍보 문구",
      }),
      "",
      "",
    );
    expect(text).toBe("🔥 밴드 특가 홍보 문구\n\nHWP 요약");
  });

  it("falls back to raw bandText when band_marketing_copy is empty", () => {
    const text = buildBandDescription(
      minimalBandParsed({
        description: "HWP 요약",
        band_marketing_copy: null,
      }),
      "밴드 원문 붙여넣기",
      "HWP 원문",
    );
    expect(text).toBe("밴드 원문 붙여넣기\n\nHWP 요약");
  });

  it("does not duplicate raw bandText when band_marketing_copy exists", () => {
    const text = buildBandDescription(
      minimalBandParsed({
        description: "HWP 요약",
        band_marketing_copy: "🔥 밴드 특가 홍보 문구",
      }),
      "밴드 원문 전체 붙여넣기",
      "",
    );
    expect(text).toBe("🔥 밴드 특가 홍보 문구\n\nHWP 요약");
    expect(text).not.toContain("밴드 원문 전체 붙여넣기");
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
  it("maps meals and description into events with meals last", () => {
    const v2 = mapItineraryDaysToV2(minimalBandParsed().itinerary_v2_json);
    expect(v2?.days).toHaveLength(1);
    const events = v2?.days[0].events ?? [];
    expect(events[0]).toMatchObject({ heading: "1일차", timeOfDay: "종일", displayRole: "activity" });
    expect(events.map((e) => e.heading).slice(-2)).toEqual(["중식", "석식"]);
    expect(events.filter((e) => e.displayRole === "summary").map((e) => e.heading)).toEqual([
      "중식",
      "석식",
    ]);
    expect(events.some((e) => e.heading === "중식" && e.description === "흑돼지")).toBe(true);
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
    expect(events.some((e) => e.description?.includes("약 40분"))).toBe(true);
  });

  it("splits legacy description on two or more clock times", () => {
    const v2 = mapItineraryDaysToV2([
      {
        day: 1,
        title: "인천 출발 / 연태 도착",
        description: "08:55 인천 국제공항 출발\n09:25 연태 국제공항 도착",
        meals: { breakfast: null, lunch: "중식", dinner: null },
      },
    ]);
    const events = v2?.days[0].events ?? [];
    const depart = events.find((e) => e.timeText === "08:55");
    const arrive = events.find((e) => e.timeText === "09:25");
    expect(depart?.heading).toContain("인천");
    expect(arrive?.heading).toContain("연태");
    expect(depart).not.toBe(arrive);
    expect(events.at(-1)).toMatchObject({ heading: "중식", displayRole: "summary" });
  });

  it("maps 연태 day 1 events with split flights and meal summaries last", () => {
    const v2 = mapItineraryDaysToV2([
      {
        day: 1,
        title: "인천 출발 / 연태 도착 / 18홀 라운드",
        events: [
          {
            heading: "인천 국제공항 출발",
            description: null,
            timeText: "08:55",
            timeOfDay: "오전",
            location: null,
          },
          {
            heading: "연태 국제공항 도착",
            description: null,
            timeText: "09:25",
            timeOfDay: "오전",
            location: null,
          },
          {
            heading: "중식",
            description: "현지식",
            timeText: null,
            timeOfDay: "오후",
            location: null,
          },
          {
            heading: "가이드 미팅 후 호텔 이동",
            description: "약 40분",
            timeText: null,
            timeOfDay: null,
            location: null,
          },
          {
            heading: "18홀 라운드",
            description: "회원제 추가요금",
            timeText: null,
            timeOfDay: null,
            location: null,
          },
          {
            heading: "석식 후 호텔 휴식",
            description: null,
            timeText: null,
            timeOfDay: null,
            location: null,
          },
          {
            heading: "석식",
            description: "호텔식",
            timeText: null,
            timeOfDay: "저녁",
            location: null,
          },
          {
            heading: "숙소",
            description: "천홍 호텔 또는 동급",
            timeText: null,
            timeOfDay: null,
            location: null,
          },
        ],
        description: null,
        meals: { breakfast: null, lunch: "현지식", dinner: "호텔식" },
      },
    ]);
    const events = v2?.days[0].events ?? [];
    const headings = events.map((e) => e.heading);
    expect(events.find((e) => e.timeText === "08:55")?.heading).toBe("인천 국제공항 출발");
    expect(events.find((e) => e.timeText === "09:25")?.heading).toBe("연태 국제공항 도착");
    expect(headings.indexOf("인천 국제공항 출발")).toBeLessThan(headings.indexOf("연태 국제공항 도착"));
    expect(events.find((e) => e.heading === "가이드 미팅 후 호텔 이동")?.displayRole).toBe("activity");
    expect(events.find((e) => e.heading === "석식 후 호텔 휴식")?.displayRole).toBe("activity");
    expect(headings.slice(-3)).toEqual(["중식", "석식", "숙소"]);
    expect(events.filter((e) => e.displayRole === "summary").map((e) => e.heading)).toEqual([
      "중식",
      "석식",
      "숙소",
    ]);
    expect(headings.filter((h) => h === "중식")).toHaveLength(1);
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
    expect(payload.golf_course_info).toBeNull();
    expect(payload.theme_chart_json).toBeNull();
  });

  it("maps theme_chart_json from itinerary parse", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalBandParsed({
        theme_chart_json: {
          items: [
            { label: "골프", percent: 2 },
            { label: "관광", percent: 1 },
            { label: "식사", percent: 1 },
          ],
        },
      }),
      bandText: "밴드 본문",
      hwpText: "",
    });
    expect(payload.theme_chart_json).toEqual({
      items: [
        { label: "골프", percent: 50 },
        { label: "관광", percent: 25 },
        { label: "식사", percent: 25 },
      ],
    });
  });

  it("stores golf course info separately from band description", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalBandParsed({
        band_marketing_copy: "밴드 홍보",
        description: "HWP 개요",
      }),
      bandText: "밴드 본문",
      hwpText: "",
      golfCourseInfo: "  18홀 챔피언십 코스  ",
    });

    expect(payload.description).toBe("밴드 홍보\n\nHWP 개요");
    expect(payload.golf_course_info).toBe("18홀 챔피언십 코스");
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
    expect(payload.package_catalog_json).toBeUndefined();
    expect(payload.selling_points_json).toEqual({
      corePoints: "핵심포인트 원문",
      meals: "식사 안내",
    });
    expect(payload.travel_notes).toBe("여행 유의사항");
    expect(payload.meta_title).toBe("제주 골프");
    expect(payload.point_tourism).toBe("O");
    expect(payload.meta_info).toBe("제주항공 OZ8123");
  });

  it("normalizes AI meta_title hashtags and caps at 8 keywords", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalBandParsed({
        meta_title: "#제주 #골프 #72홀 #특가 #가족 #휴양 #직항 #라운딩 #버림",
      }),
      bandText: "",
      hwpText: "",
    });
    expect(payload.meta_title).toBe("제주 골프 72홀 특가 가족 휴양 직항 라운딩");
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
      bandText: "2025년 7월 골프투어",
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
        status: "AVAILABLE",
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
        status: "AVAILABLE",
      },
    ]);
    expect(payload.price).toBe(890000);
    expect(payload.departure_from_date).toBe("2026-07-23");
  });

  it("overrides AI-hallucinated year when source has no explicit year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00+09:00"));

    const payload = mapBandParsedToInsert({
      parsed: minimalBandParsed({
        price: 999000,
        departure_schedules: [
          {
            departure_date: "2023-07-23",
            return_date: "2023-07-26",
            price: 890000,
            label: "7/23(수)",
            status: "AVAILABLE",
          },
          {
            departure_date: "2023-07-30",
            return_date: null,
            price: 920000,
            label: "7/30(목)",
            status: null,
          },
        ],
        departure_from_date: "2023-07-23",
        departure_to_date: "2023-07-26",
      }),
      bandText: "여름휴가 석문산 골프 — 7/23, 7/30 출발",
      hwpText: "",
    });

    expect(payload.departure_schedules_json).toEqual([
      {
        departureDate: "2026-07-23",
        returnDate: "2026-07-26",
        price: 890000,
        label: "7/23(수)",
        status: "AVAILABLE",
      },
      {
        departureDate: "2026-07-30",
        returnDate: null,
        price: 920000,
        label: "7/30(목)",
        status: "AVAILABLE",
      },
    ]);
    expect(payload.departure_from_date).toBe("2026-07-23");
    expect(payload.departure_to_date).toBe("2026-07-26");

    vi.useRealTimers();
  });

  it("ignores document write dates and bare years — uses current year without 20xx년", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00+09:00"));

    const payload = mapBandParsedToInsert({
      parsed: minimalBandParsed({
        departure_schedules: [
          {
            departure_date: "2023-07-24",
            return_date: null,
            price: 1799000,
            label: "7/24 출발 (요금 179만)",
            status: null,
          },
        ],
        departure_from_date: "2023-07-24",
      }),
      bandText: "7/24 출발 1,799,000",
      hwpText: "작성일: 2023.01.15\n문서번호 2023-0042",
    });

    expect(payload.departure_schedules_json).toEqual([
      {
        departureDate: "2026-07-24",
        returnDate: null,
        price: 1799000,
        label: "7/24 출발 (요금 179만)",
        status: "AVAILABLE",
      },
    ]);
    expect(payload.departure_from_date).toBe("2026-07-24");
    expect(hasExplicitYearInBandSource("7/24 출발", "작성일: 2023.01.15")).toBe(false);

    vi.useRealTimers();
  });

  it("respects explicit year in source when AI returns matching ISO dates", () => {
    const payload = mapBandParsedToInsert({
      parsed: minimalBandParsed({
        departure_schedules: [
          {
            departure_date: "2025-07-23",
            return_date: null,
            price: 890000,
            label: null,
            status: null,
          },
        ],
        departure_from_date: "2025-07-23",
      }),
      bandText: "2025년 7월 특가",
      hwpText: "",
    });

    expect(payload.departure_schedules_json).toEqual([
      {
        departureDate: "2025-07-23",
        returnDate: null,
        price: 890000,
        label: null,
        status: "AVAILABLE",
      },
    ]);
    expect(payload.departure_from_date).toBe("2025-07-23");
  });
});

describe("inferBandScheduleDefaultYear", () => {
  it("returns current KST year when source has no explicit year", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00+09:00"));

    expect(inferBandScheduleDefaultYear("7/23 출발", "")).toBe(2026);
    expect(hasExplicitYearInBandSource("7/23 출발", "")).toBe(false);

    vi.useRealTimers();
  });

  it("returns most frequent year from source text", () => {
    expect(inferBandScheduleDefaultYear("2026년 여름 골프투어", "")).toBe(2026);
    expect(hasExplicitYearInBandSource("2026년 여름", "")).toBe(true);
  });

  it("ignores AI-parsed years — only source text matters", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-10T12:00:00+09:00"));

    expect(
      inferBandScheduleDefaultYear("여름 골프 7/23", ""),
    ).toBe(2026);

    vi.useRealTimers();
  });
});
