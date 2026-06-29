import { describe, expect, it } from "vitest";
import {
  collectItineraryImageUrls,
  countItineraryEvents,
  mapExternalItineraryToV2,
  mapItineraryBlocksToV2,
} from "@/lib/admin/externalImport/mapExternalItineraryToV2";
import type { ItineraryBlock } from "@/lib/admin/externalImport/itineraryBlockTypes";
import type { ExternalParsedItineraryV2 } from "@/lib/admin/externalImport/externalProductSchema";

/** 계림 2일차 스크린샷 기반 mock (상비산·첩채산) */
const GYERIM_DAY2_FIXTURE: ExternalParsedItineraryV2 = {
  days: [
    {
      day: 2,
      dateText: "11/28(토)",
      title: "계림 관광",
      coverImageUrl: "https://cdn.example.com/gyerim/sangbishan-1.jpg",
      events: [
        {
          heading: "상비산",
          description:
            "상비산은 계림의 대표적인 카르스트 지형으로, 기이한 암석과 동굴이 어우러진 명소입니다. 산책로를 따라 걸으며 자연의 신비를 감상할 수 있습니다.",
          timeOfDay: "오전",
          timeText: "09:00",
          imageUrls: [
            "https://cdn.example.com/gyerim/sangbishan-1.jpg",
            "https://cdn.example.com/gyerim/sangbishan-2.jpg",
            "https://cdn.example.com/gyerim/sangbishan-3.jpg",
          ],
        },
        {
          heading: "첩채산",
          description:
            "첩채산은 계림 시내에서 가장 아름다운 일몰 명소로 알려져 있습니다. 정상에서 펼쳐지는 계림 시가지 전경이 장관입니다.",
          timeOfDay: "오후",
          timeText: "14:30",
          imageUrls: [
            "https://cdn.example.com/gyerim/diecai-1.jpg",
            "https://cdn.example.com/gyerim/diecai-2.jpg",
            "https://cdn.example.com/gyerim/diecai-3.jpg",
          ],
        },
        {
          heading: "중식",
          description: "현지식 중식 (계림 미식)",
          timeOfDay: "오후",
          timeText: "12:00",
          imageUrls: [],
        },
      ],
    },
  ],
};

describe("mapExternalItineraryToV2", () => {
  it("maps 상비산/첩채산 as separate events with images", () => {
    const result = mapExternalItineraryToV2(GYERIM_DAY2_FIXTURE);
    expect(result).not.toBeNull();
    expect(result!.days).toHaveLength(1);

    const day2 = result!.days[0];
    expect(day2.day).toBe(2);
    expect(day2.coverImageUrl).toBe("https://cdn.example.com/gyerim/sangbishan-1.jpg");
    expect(day2.events).toHaveLength(3);

    const sangbishan = day2.events.find((e) => e.heading === "상비산");
    const diecai = day2.events.find((e) => e.heading === "첩채산");

    expect(sangbishan?.images).toHaveLength(3);
    expect(sangbishan?.images?.[0]).toMatchObject({
      url: "https://cdn.example.com/gyerim/sangbishan-1.jpg",
      sortOrder: 0,
      isCover: true,
      status: "active",
    });
    expect(diecai?.images).toHaveLength(3);
    expect(diecai?.description).toContain("일몰");
  });

  it("caps event images at 8", () => {
    const manyUrls = Array.from({ length: 12 }, (_, i) => `https://cdn.example.com/img${i}.jpg`);
    const parsed: ExternalParsedItineraryV2 = {
      days: [
        {
          day: 1,
          dateText: null,
          title: null,
          coverImageUrl: null,
          events: [
            {
              heading: "관광",
              description: "테스트",
              timeOfDay: "종일",
              timeText: null,
              imageUrls: manyUrls,
            },
          ],
        },
      ],
    };
    const result = mapExternalItineraryToV2(parsed);
    expect(result!.days[0].events[0].images).toHaveLength(8);
  });

  it("filters logo/icon URLs from events", () => {
    const parsed: ExternalParsedItineraryV2 = {
      days: [
        {
          day: 1,
          dateText: null,
          title: null,
          coverImageUrl: null,
          events: [
            {
              heading: "관광",
              description: null,
              timeOfDay: null,
              timeText: null,
              imageUrls: [
                "https://cdn.example.com/logo.png",
                "https://cdn.example.com/scene.jpg",
              ],
            },
          ],
        },
      ],
    };
    const result = mapExternalItineraryToV2(parsed);
    expect(result!.days[0].events[0].images).toHaveLength(1);
    expect(result!.days[0].events[0].images?.[0].url).toBe("https://cdn.example.com/scene.jpg");
  });

  it("counts events and collects image URLs", () => {
    expect(countItineraryEvents(GYERIM_DAY2_FIXTURE)).toBe(3);
    const v2 = mapExternalItineraryToV2(GYERIM_DAY2_FIXTURE)!;
    const urls = collectItineraryImageUrls(v2);
    expect(urls.length).toBeGreaterThanOrEqual(6);
    expect(urls).toContain("https://cdn.example.com/gyerim/sangbishan-1.jpg");
  });

  it("returns null for empty days", () => {
    expect(mapExternalItineraryToV2(null)).toBeNull();
    expect(mapExternalItineraryToV2({ days: [] })).toBeNull();
  });
});

describe("mapItineraryBlocksToV2", () => {
  const blocks: ItineraryBlock[] = [
    {
      day: 2,
      dateText: "11/28(토)",
      heading: "상비산",
      description: "문단1\n\n문단2\n\n문단3\n\n문단4",
      imageUrls: [
        "https://cdn.example.com/sangbishan-1.jpg",
        "https://cdn.example.com/sangbishan-2.jpg",
        "https://cdn.example.com/sangbishan-3.jpg",
      ],
      kind: "sightseeing",
      timeText: "09:00",
      timeOfDay: "오전",
    },
    {
      day: 2,
      heading: "첩채산",
      description: "일몰 명소",
      imageUrls: ["https://cdn.example.com/diecai-1.jpg"],
      kind: "sightseeing",
    },
  ];

  it("preserves block descriptions and all images without summarizing", () => {
    const result = mapItineraryBlocksToV2(blocks);
    expect(result?.days[0].events).toHaveLength(2);
    const sangbishan = result?.days[0].events.find((e) => e.heading === "상비산");
    expect(sangbishan?.description).toContain("문단4");
    expect(sangbishan?.images).toHaveLength(3);
    expect(sangbishan?.timeText).toBe("09:00");
  });

  it("keeps meal-only blocks without description or images", () => {
    const mealBlocks: ItineraryBlock[] = [
      {
        day: 2,
        heading: "조식",
        description: "",
        imageUrls: [],
        kind: "meal",
      },
      {
        day: 2,
        heading: "중식",
        description: "",
        imageUrls: [],
        kind: "meal",
      },
    ];
    const result = mapItineraryBlocksToV2(mealBlocks);
    expect(result?.days).toHaveLength(1);
    expect(result?.days[0].events).toHaveLength(2);
    expect(result?.days[0].events.map((e) => e.heading)).toEqual(["조식", "중식"]);
  });

  it("maps multi-day blocks including day1 flight and day2 sightseeing", () => {
    const multiDayBlocks: ItineraryBlock[] = [
      {
        day: 1,
        dateText: "11/27(금)",
        heading: "인천국제공항 출발",
        description: "",
        imageUrls: [],
        kind: "move",
      },
      {
        day: 2,
        dateText: "11/28(토)",
        heading: "상비산",
        description: "계림 대표 관광지",
        imageUrls: [
          "https://cdn.example.com/sangbishan-1.jpg",
          "https://cdn.example.com/sangbishan-2.jpg",
          "https://cdn.example.com/sangbishan-3.jpg",
        ],
        kind: "sightseeing",
      },
      {
        day: 2,
        heading: "첩채산",
        description: "",
        imageUrls: ["https://cdn.example.com/diecai-1.jpg"],
        kind: "sightseeing",
      },
      {
        day: 2,
        heading: "예정호텔",
        description: "계림 시내 호텔",
        imageUrls: [],
        kind: "other",
      },
    ];
    const result = mapItineraryBlocksToV2(multiDayBlocks);
    expect(result?.days).toHaveLength(2);
    expect(result?.days[0].day).toBe(1);
    expect(result?.days[0].events[0].heading).toContain("출발");
    expect(result?.days[1].day).toBe(2);
    expect(result?.days[1].events.length).toBeGreaterThanOrEqual(3);
    const sangbishan = result?.days[1].events.find((e) => e.heading === "상비산");
    expect(sangbishan?.images).toHaveLength(3);
  });

  it("maps summary hotel/meal blocks with iconKey and displayRole", () => {
    const blocks: ItineraryBlock[] = [
      {
        day: 2,
        heading: "상비산",
        description: "관광 설명",
        imageUrls: ["https://cdn.example.com/sangbishan-1.jpg"],
        kind: "sightseeing",
        displayRole: "activity",
      },
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
        description: "[조식] 호텔식 · [중식] 현지식 · [석식] 맥주어",
        imageUrls: [],
        kind: "meal",
        displayRole: "summary",
      },
    ];
    const result = mapItineraryBlocksToV2(blocks);
    const hotel = result?.days[0].events.find((e) => e.heading === "호텔");
    const meal = result?.days[0].events.find((e) => e.heading === "식사");
    expect(hotel?.displayRole).toBe("summary");
    expect(hotel?.iconKey).toBe("hotel");
    expect(meal?.displayRole).toBe("summary");
    expect(meal?.iconKey).toBe("utensils");
  });

  it("keeps distinct images and descriptions per sightseeing block", () => {
    const blocks: ItineraryBlock[] = [
      {
        day: 2,
        heading: "상비산",
        description: "문단1\n\n문단2\n\n문단3\n\n문단4",
        imageUrls: [
          "https://cdn.example.com/sangbishan-1.jpg",
          "https://cdn.example.com/sangbishan-2.jpg",
          "https://cdn.example.com/sangbishan-3.jpg",
        ],
        kind: "sightseeing",
      },
      {
        day: 2,
        heading: "첩채산",
        description: "일몰 명소 설명",
        imageUrls: ["https://cdn.example.com/diecai-1.jpg"],
        kind: "sightseeing",
      },
    ];
    const result = mapItineraryBlocksToV2(blocks);
    const sangbishan = result?.days[0].events.find((e) => e.heading === "상비산");
    const diecai = result?.days[0].events.find((e) => e.heading === "첩채산");
    expect(sangbishan?.images).toHaveLength(3);
    expect(diecai?.images).toHaveLength(1);
    expect(sangbishan?.images?.[0].url).not.toBe(diecai?.images?.[0].url);
    expect(sangbishan?.description).toContain("문단4");
    expect(diecai?.description).toContain("일몰");
  });
});
