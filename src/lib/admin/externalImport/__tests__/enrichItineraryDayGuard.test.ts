import { describe, expect, it } from "vitest";

import { enrichAiItineraryWithBlocks } from "@/lib/admin/externalImport/enrichItineraryWithBlocks";
import type { ItineraryBlock } from "@/lib/admin/externalImport/itineraryBlockTypes";

describe("enrichAiItineraryWithBlocks day guard", () => {
  it("does not attach day=2 block to day=1 when explicit day blocks exist", () => {
    const ai = {
      days: [
        { day: 1, events: [{ heading: "양강", description: "day1 short" }] },
        { day: 2, events: [{ heading: "양강", description: "day2 short" }] },
      ],
    };
    const blocks: ItineraryBlock[] = [
      {
        day: 2,
        heading: "양강",
        description: "양강 유람 상세 설명입니다.",
        imageUrls: ["https://example.com/yangshuo.jpg"],
        kind: "sightseeing",
      },
    ];
    const result = enrichAiItineraryWithBlocks(ai, blocks);
    const day1 = result?.days?.find((d) => d.day === 1);
    const day2 = result?.days?.find((d) => d.day === 2);
    expect(day1?.events[0]?.description).toBe("day1 short");
    expect(day2?.events[0]?.description).toBe("양강 유람 상세 설명입니다.");
  });

  it("ignores day-agnostic blocks when explicit day blocks exist", () => {
    const ai = {
      days: [{ day: 1, events: [{ heading: "관광", description: "a" }] }],
    };
    const blocks: ItineraryBlock[] = [
      {
        day: 2,
        heading: "양강",
        description: "day two only",
        imageUrls: [],
        kind: "sightseeing",
      },
      {
        heading: "양강",
        description: "day agnostic should not apply",
        imageUrls: [],
        kind: "sightseeing",
      },
    ];
    const result = enrichAiItineraryWithBlocks(ai, blocks);
    expect(result?.days?.[0]?.events.some((e) => e.description?.includes("day agnostic"))).toBe(
      false,
    );
  });
});
