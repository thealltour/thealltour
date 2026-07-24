import { describe, expect, it } from "vitest";

import {
  enrichAiItineraryWithBlocks,
  headingsMatchFuzzy,
  normalizeHeadingForMatch,
} from "@/lib/admin/externalImport/enrichItineraryWithBlocks";
import type { ItineraryBlock } from "@/lib/admin/externalImport/itineraryBlockTypes";

const KIYOMIZU_FULL = `오토와산 뒤에 있는 법상종의 총본산 사찰이자 교토 대표 관광지입니다. '물이 맑은 절'이라는 의미로 '청수사'라는 이름으로도 불립니다. 778년 권력자 사카노우에노 다무라마로가 창건했습니다. 여러 번의 화재로 소실을 겪다가 1633년 쇼군 도쿠가와 이에미츠에 의해 지금의 모습으로 재건됐습니다. 높은 곳에 있는 본당 건너편 툇마루에 서 있으면 울창한 수림 너머로 교토의 아름다운 모습이 보입니다. 특히 하늘이 맑고 깨끗한 날에는 오사카까지 볼 수 있습니다. 봄에는 벚꽃이 흐드러지게 피고, 여름에는 초록색 잎사귀가 가득하며, 가을에는 붉은 단풍, 겨울에는 함박눈이 쌓이며 사방이 아름답게 물들어갑니다.`;

describe("heading fuzzy match", () => {
  it("matches Korean title with English subtitle in parentheses", () => {
    expect(headingsMatchFuzzy("기요미즈데라", "기요미즈데라 (Kiyomizu-dera)")).toBe(true);
    expect(normalizeHeadingForMatch("기요미즈데라 (Kiyomizu-dera)")).toContain("기요미즈데라");
  });
});

describe("enrichAiItineraryWithBlocks full description preservation", () => {
  it("replaces short AI summary with full DOM sightseeing description (kiyomizu-style)", () => {
    const ai = {
      days: [
        {
          day: 2,
          dateText: null,
          title: null,
          coverImageUrl: null,
          events: [
            {
              heading: "기요미즈데라 (Kiyomizu-dera)",
              description: "교토의 유명한 사찰",
              timeOfDay: "오전" as const,
              timeText: "10:00",
              imageUrls: ["https://cdn.example.com/kiyomizu-1.jpg"],
            },
          ],
        },
      ],
    };

    const blocks: ItineraryBlock[] = [
      {
        day: 2,
        heading: "기요미즈데라",
        description: KIYOMIZU_FULL,
        imageUrls: [
          "https://cdn.example.com/kiyomizu-1.jpg",
          "https://cdn.example.com/kiyomizu-2.jpg",
          "https://cdn.example.com/kiyomizu-3.jpg",
        ],
        kind: "sightseeing",
        timeOfDay: "오전",
      },
    ];

    const result = enrichAiItineraryWithBlocks(ai, blocks);
    const event = result?.days?.[0]?.events?.[0];
    expect(event?.description).toBe(KIYOMIZU_FULL);
    expect(event?.description).toContain("오토와산");
    expect(event?.description).toContain("1633년");
    expect(event?.description?.length ?? 0).toBeGreaterThan(200);
  });

  it("matches DOM block via shared image URL when headings differ", () => {
    const shared = "https://cdn.example.com/poi-shared.jpg";
    const ai = {
      days: [
        {
          day: 1,
          dateText: null,
          title: null,
          coverImageUrl: null,
          events: [
            {
              heading: "청수사 방문",
              description: "짧은 요약",
              timeOfDay: null,
              timeText: null,
              imageUrls: [shared],
            },
          ],
        },
      ],
    };
    const blocks: ItineraryBlock[] = [
      {
        day: 1,
        heading: "기요미즈데라",
        description: KIYOMIZU_FULL,
        imageUrls: [shared, "https://cdn.example.com/other.jpg"],
        kind: "sightseeing",
      },
    ];

    const result = enrichAiItineraryWithBlocks(ai, blocks);
    expect(result?.days?.[0]?.events?.[0]?.description).toBe(KIYOMIZU_FULL);
  });

  it("appends unmatched sightseeing DOM block onto the day", () => {
    const ai = {
      days: [
        {
          day: 1,
          dateText: null,
          title: null,
          coverImageUrl: null,
          events: [
            {
              heading: "호텔 체크인",
              description: "숙소 도착",
              timeOfDay: "저녁" as const,
              timeText: null,
              imageUrls: [],
            },
          ],
        },
      ],
    };
    const blocks: ItineraryBlock[] = [
      {
        day: 1,
        heading: "기요미즈데라",
        description: KIYOMIZU_FULL,
        imageUrls: ["https://cdn.example.com/kiyomizu-1.jpg"],
        kind: "sightseeing",
      },
    ];

    const result = enrichAiItineraryWithBlocks(ai, blocks);
    const events = result?.days?.[0]?.events ?? [];
    expect(events).toHaveLength(2);
    expect(events.some((e) => e.heading === "기요미즈데라" && e.description === KIYOMIZU_FULL)).toBe(
      true,
    );
  });
});
