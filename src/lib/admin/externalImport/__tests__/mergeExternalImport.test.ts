import { describe, expect, it } from "vitest";
import { mergeExternalImport } from "@/lib/admin/externalImport/mergeExternalImport";
import type { ExternalParsedMeta } from "@/lib/admin/externalImport/externalProductMetaSchema";
import type { ItineraryBlock } from "@/lib/admin/externalImport/itineraryBlockTypes";

function minimalMeta(overrides: Partial<ExternalParsedMeta> = {}): ExternalParsedMeta {
  return {
    title: "계림 5일",
    description: "패키지",
    price: 1290000,
    duration: "3박5일",
    theme: "중국",
    included_items: "항공+숙박",
    excluded_items: "개인경비",
    booking_notes: null,
    status: "AVAILABLE",
    departure_flight_number: null,
    departure_from_airport: null,
    departure_to_airport: null,
    departure_time: null,
    arrival_time: null,
    seo_hashtags: null,
    selling_points_json: null,
    ...overrides,
  };
}

const SANG_BI_SHAN_BLOCK: ItineraryBlock = {
  day: 2,
  dateText: "11/28(토)",
  heading: "상비산",
  description:
    "계림 최고의 명산, 상비산(象鼻山)은 계림의 그림 엽서에 자주 등장하는 장소입니다.\n\n높이 200m, 길이 103m의 석회암으로 3억 6천만 년 전 형성되었습니다.\n\n1986년 삼산공원이 조성되었습니다.",
  imageUrls: [
    "https://cdn.example.com/sangbishan-1.jpg",
    "https://cdn.example.com/sangbishan-2.jpg",
    "https://cdn.example.com/sangbishan-3.jpg",
  ],
  kind: "sightseeing",
  timeText: "09:00",
  timeOfDay: "오전",
};

describe("mergeExternalImport", () => {
  it("uses deterministic gallery over AI", () => {
    const merged = mergeExternalImport({
      meta: minimalMeta(),
      productGalleryUrls: [
        "https://cdn.example.com/gallery-1.jpg",
        "https://cdn.example.com/gallery-2.jpg",
        "https://cdn.example.com/gallery-3.jpg",
      ],
      heroImageUrl: "https://cdn.example.com/gallery-1.jpg",
      itineraryBlocks: [SANG_BI_SHAN_BLOCK],
    });

    expect(merged.image_url).toBe("https://cdn.example.com/gallery-1.jpg");
    expect(merged.images_json).toHaveLength(3);
    expect(merged.itinerary_v2_json?.days).toHaveLength(1);
    expect(merged.itinerary_v2_json?.days[0].events[0].heading).toBe("상비산");
    expect(merged.itinerary_v2_json?.days[0].events[0].description).toContain("200m");
    const firstImages =
      merged.itinerary_v2_json?.days[0].events[0].images ??
      (merged.itinerary_v2_json?.days[0].events[0] as { imageUrls?: string[] }).imageUrls;
    expect(firstImages).toHaveLength(3);
  });

  it("enriches matching AI events with richer DOM blocks", () => {
    const merged = mergeExternalImport({
      meta: minimalMeta(),
      itineraryBlocks: [SANG_BI_SHAN_BLOCK],
      aiItineraryFallback: {
        days: [
          {
            day: 2,
            dateText: null,
            title: null,
            coverImageUrl: null,
            events: [
              {
                heading: "상비산",
                description: "짧은 요약",
                timeOfDay: "오전",
                timeText: "09:00",
                imageUrls: ["https://cdn.example.com/wrong.jpg"],
              },
              {
                heading: "항공편",
                description: "제주항공",
                timeOfDay: null,
                timeText: null,
                imageUrls: [],
              },
            ],
          },
        ],
      },
    });

    const events = merged.itinerary_v2_json?.days[0].events ?? [];
    expect(events).toHaveLength(2);
    const sangbishan = events.find((e) => e.heading === "상비산");
    expect(sangbishan?.description).toContain("석회암");
    expect(sangbishan?.images).toHaveLength(3);
    expect(events.find((e) => e.heading === "항공편")).toBeTruthy();
  });

  it("falls back to AI itinerary when blocks are empty", () => {
    const merged = mergeExternalImport({
      meta: minimalMeta(),
      itineraryBlocks: [],
      aiItineraryFallback: {
        days: [
          {
            day: 1,
            dateText: null,
            title: "1일차",
            coverImageUrl: null,
            events: [
              {
                heading: "출발",
                description: "인천 출발",
                timeOfDay: "오전",
                timeText: "09:00",
                imageUrls: [],
              },
            ],
          },
        ],
      },
    });

    expect(merged.itinerary_v2_json?.days[0].events[0].heading).toBe("출발");
  });

  it("uses AI itinerary by default when no legacy blocks", () => {
    const merged = mergeExternalImport({
      meta: minimalMeta(),
      aiItineraryFallback: {
        days: [
          {
            day: 2,
            dateText: "11/28(토)",
            title: null,
            coverImageUrl: null,
            events: [
              {
                heading: "상비산",
                description: "계림 명산 설명",
                timeOfDay: "오전",
                timeText: "09:00",
                imageUrls: [
                  "https://cdn.example.com/sangbishan-1.jpg",
                  "https://cdn.example.com/sangbishan-2.jpg",
                ],
              },
              {
                heading: "첩채산",
                description: "일몰 명소",
                timeOfDay: "오후",
                timeText: null,
                imageUrls: ["https://cdn.example.com/diecai-1.jpg"],
              },
            ],
          },
        ],
      },
    });

    const events = merged.itinerary_v2_json?.days[0].events ?? [];
    expect(events).toHaveLength(2);
    expect(events[0].heading).toBe("상비산");
    expect(events[1].heading).toBe("첩채산");
    const sangbishanImages =
      events[0].images ??
      (events[0] as { imageUrls?: string[] }).imageUrls;
    expect(sangbishanImages).toHaveLength(2);
  });

  it("merges itinerary with meal-only blocks", () => {
    const merged = mergeExternalImport({
      meta: minimalMeta(),
      itineraryBlocks: [
        SANG_BI_SHAN_BLOCK,
        {
          day: 2,
          heading: "조식",
          description: "",
          imageUrls: [],
          kind: "meal",
        },
        {
          day: 2,
          heading: "석식",
          description: "",
          imageUrls: [],
          kind: "meal",
        },
      ],
    });

    const day2Events = merged.itinerary_v2_json?.days[0].events ?? [];
    expect(day2Events.map((e) => e.heading)).toEqual(
      expect.arrayContaining(["상비산", "조식", "석식"]),
    );
    expect(day2Events).toHaveLength(3);
  });

  it("appends notice blocks (출입국 정보) when missing from AI", () => {
    const merged = mergeExternalImport({
      meta: minimalMeta(),
      itineraryBlocks: [
        {
          day: 5,
          heading: "출입국 정보",
          description: "중국 무비자 입국 시 준비사항\n\n온라인 입국신고서 작성 가이드",
          imageUrls: ["https://cdn.example.com/qr-code.png"],
          kind: "notice",
        },
      ],
      aiItineraryFallback: {
        days: [
          {
            day: 5,
            dateText: "11/30(월)",
            title: "5일차",
            coverImageUrl: null,
            events: [
              {
                heading: "귀국",
                description: "인천 도착",
                timeOfDay: "오후",
                timeText: null,
                imageUrls: [],
              },
            ],
          },
        ],
      },
    });

    const events = merged.itinerary_v2_json?.days[0].events ?? [];
    expect(events.map((e) => e.heading)).toContain("출입국 정보");
    const notice = events.find((e) => e.heading === "출입국 정보");
    expect(notice?.description).toContain("무비자");
    expect(notice?.images).toHaveLength(1);
    expect(notice?.iconKey).toBe("info");
  });

  it("overrides title and meta_title from DOM sources", () => {
    const fullTitle =
      "[대구출발][Semi-프리미엄] 계림직항 5일#인상유삼저공연VIP #양강사호유람";
    const merged = mergeExternalImport({
      meta: minimalMeta({ title: "AI 요약 제목" }),
      sourceProductTitle: fullTitle,
      seoHashtags: ["아름다운풍경속여행", "특별한추억만들기"],
    });
    expect(merged.title).toBe(fullTitle);
    expect(merged.meta_title).toBe("아름다운풍경속여행 특별한추억만들기");
  });

  it("merges multi-day itinerary with summary hotel and meal blocks", () => {
    const merged = mergeExternalImport({
      meta: minimalMeta(),
      itineraryBlocks: [
        {
          day: 1,
          dateText: "11/26(목)",
          heading: "인천국제공항 출발",
          description: "제주항공 7C8631",
          imageUrls: [],
          kind: "move",
        },
        SANG_BI_SHAN_BLOCK,
        {
          day: 2,
          heading: "호텔",
          description: "리이호텔 · 메후드리즈호텔",
          imageUrls: [],
          kind: "other",
          displayRole: "summary",
        },
        {
          day: 2,
          heading: "식사",
          description: "[조식] 호텔식 · [중식] 현지식",
          imageUrls: [],
          kind: "meal",
          displayRole: "summary",
        },
      ],
    });

    expect(merged.itinerary_v2_json?.days).toHaveLength(2);
    expect(merged.itinerary_v2_json?.days[0].day).toBe(1);
    expect(merged.itinerary_v2_json?.days[1].events.find((e) => e.heading === "상비산")).toBeTruthy();
    const hotel = merged.itinerary_v2_json?.days[1].events.find((e) => e.heading === "호텔");
    const meal = merged.itinerary_v2_json?.days[1].events.find((e) => e.heading === "식사");
    expect(hotel?.displayRole).toBe("summary");
    expect(hotel?.iconKey).toBe("hotel");
    expect(meal?.displayRole).toBe("summary");
    expect(meal?.iconKey).toBe("utensils");
  });

  it("passes theme_chart_json from itinerary parse onto the product", () => {
    const merged = mergeExternalImport({
      meta: minimalMeta(),
      theme_chart_json: {
        items: [
          { label: "관광", percent: 70 },
          { label: "식사", percent: 30 },
        ],
      },
    });
    expect(merged.theme_chart_json).toEqual({
      items: [
        { label: "관광", percent: 70 },
        { label: "식사", percent: 30 },
      ],
    });
  });
});
