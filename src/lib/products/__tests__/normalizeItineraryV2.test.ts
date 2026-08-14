import { describe, expect, it } from "vitest";
import { normalizeProduct } from "@/lib/products";

describe("normalizeProduct itinerary_v2_json", () => {
  it("keeps displayRole on itinerary events", () => {
    const product = normalizeProduct({
      id: "p1",
      title: "테스트",
      description: "설명",
      image_url: "https://example.com/a.jpg",
      category: "여행상품",
      itinerary_v2_json: {
        days: [
          {
            day: 1,
            title: "1일차",
            events: [
              { heading: "인천 국제공항 출발", timeText: "08:55", displayRole: "activity" },
              { heading: "중식", displayRole: "summary" },
            ],
          },
        ],
      },
    });

    const events = product.itinerary_v2_json?.days[0].events ?? [];
    expect(events[0]).toMatchObject({ heading: "인천 국제공항 출발", displayRole: "activity" });
    expect(events[1]).toMatchObject({ heading: "중식", displayRole: "summary" });
  });
});
