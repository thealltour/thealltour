import { describe, expect, it } from "vitest";
import { mapExternalParsedToInsert } from "@/lib/admin/externalImport/mapExternalParsedToInsert";
import type { ExternalParsedProduct } from "@/lib/admin/externalImport/externalProductSchema";
import {
  formStringsToSellingPoints,
  normalizeSellingPoints,
  sellingPointsToFormStrings,
} from "@/lib/products/normalizeSellingPoints";
import { formatAirlineLabel } from "@/lib/products/formatAirlineLabel";

function baseParsed(overrides: Partial<ExternalParsedProduct> = {}): ExternalParsedProduct {
  return {
    title: "테스트 상품",
    description: "설명",
    price: 1000000,
    duration: "3박 5일",
    theme: "관광, 다이닝/미식",
    departure_region: "인천",
    included_items: "[교통] 왕복항공권\n[숙박] 숙박비",
    excluded_items: "개인 여행경비",
    optional_expenses: "[숙박] 객실 1인 사용료 : 200,000원",
    booking_notes: null,
    status: "AVAILABLE",
    airline_name: "제주항공",
    departure_flight_number: "7C8631",
    departure_from_airport: "인천(ICN)",
    departure_to_airport: "계림(KWL)",
    departure_from_date: "2026-11-26",
    departure_from_time: "20:00",
    departure_to_date: "2026-11-26",
    departure_to_time: "22:45",
    departure_duration: "03시간 45분",
    arrival_flight_number: "7C8632",
    arrival_from_airport: "계림(KWL)",
    arrival_to_airport: "인천(ICN)",
    arrival_from_date: "2026-11-30",
    arrival_from_time: "00:30",
    arrival_to_date: "2026-11-30",
    arrival_to_time: "05:05",
    arrival_duration: "03시간 35분",
    departure_time: null,
    arrival_time: null,
    seo_hashtags: null,
    selling_points_json: {
      corePoints: "1. 5성급 호텔",
      tourism: "관광 본문",
      meals: null,
      transport: null,
      insurance: "3억원 여행자보험",
    },
    itinerary_v2_json: null,
    image_url: "https://example.com/hero.jpg",
    images_json: ["https://example.com/hero.jpg"],
    ...overrides,
  };
}

describe("mapExternalParsedToInsert", () => {
  it("maps flight round-trip, optional expenses, selling points, and region", () => {
    const result = mapExternalParsedToInsert({
      parsed: baseParsed(),
      provider: "hanatour",
      productSourceUrl: "https://www.hanatour.com/test",
    });

    expect(result.overview_region).toBe("인천");
    expect(result.theme).toBe("관광, 다이닝/미식");
    expect(result.meta_info).toBe("제주항공 7C8631");
    expect(result.departure_flight_name).toBe("7C8631");
    expect(result.arrival_flight_name).toBe("7C8632");
    expect(result.departure_from_date).toBe("2026-11-26");
    expect(result.departure_from_time).toBe("20:00");
    expect(result.departure_to_time).toBe("22:45");
    expect(result.arrival_from_time).toBe("00:30");
    expect(result.arrival_to_time).toBe("05:05");
    expect(result.included_items).toContain("[교통]");
    expect(result.optional_expenses).toContain("200,000원");
    expect(result.selling_points_json).toEqual({
      corePoints: "1. 5성급 호텔",
      tourism: "관광 본문",
      insurance: "3억원 여행자보험",
    });
  });

  it("uses legacy departure_time when departure_from_time missing", () => {
    const result = mapExternalParsedToInsert({
      parsed: baseParsed({
        departure_from_time: null,
        departure_time: "21:00",
        departure_to_time: null,
        arrival_time: "23:00",
      }),
      provider: "hanatour",
    });
    expect(result.departure_from_time).toBe("21:00");
    expect(result.departure_to_time).toBe("23:00");
  });

  it("prefers sourceProductTitle and seoHashtags over AI parsed fields", () => {
    const fullTitle =
      "[대구출발][Semi-프리미엄] 계림직항 5일#인상유삼저공연VIP #양강사호유람";
    const result = mapExternalParsedToInsert({
      parsed: baseParsed({ title: "요약된 제목" }),
      provider: "hanatour",
      sourceProductTitle: fullTitle,
      seoHashtags: ["아름다운풍경속여행", "특별한추억만들기"],
    });
    expect(result.title).toBe(fullTitle);
    expect(result.meta_title).toBe("아름다운풍경속여행 특별한추억만들기");
  });

  it("falls back to AI seo_hashtags when dom hashtags missing", () => {
    const result = mapExternalParsedToInsert({
      parsed: baseParsed({
        seo_hashtags: ["계림여행추천", "이강유람체험"],
      }),
      provider: "hanatour",
    });
    expect(result.meta_title).toBe("계림여행추천 이강유람체험");
  });
});

describe("normalizeSellingPoints", () => {
  it("round-trips form strings and json column", () => {
    const form = {
      selling_core_points: "핵심",
      selling_tourism: "",
      selling_meals: "식사",
      selling_transport: "",
      selling_insurance: "보험",
    };
    const json = formStringsToSellingPoints(form);
    expect(json).toEqual({ corePoints: "핵심", meals: "식사", insurance: "보험" });
    expect(sellingPointsToFormStrings(json)).toEqual(form);
    expect(normalizeSellingPoints(json)).toEqual(json);
  });
});

describe("formatAirlineLabel", () => {
  it("prefers meta_info with flight number", () => {
    expect(
      formatAirlineLabel({
        airline: undefined,
        meta_info: "제주항공 7C8631",
        departure_flight_name: "7C8631",
      }),
    ).toBe("제주항공 7C8631");
  });
});
