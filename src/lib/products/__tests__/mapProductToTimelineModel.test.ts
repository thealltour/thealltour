import { describe, expect, it } from "vitest";
import { itineraryV2ToTimelineModel } from "@/lib/products/mapProductToTimelineModel";
import type { ItineraryV2 } from "@/types/product";

describe("itineraryV2ToTimelineModel", () => {
  it("passes displayRole through to timeline events", () => {
    const v2: ItineraryV2 = {
      days: [
        {
          day: 2,
          title: "양삭",
          events: [
            {
              heading: "상비산",
              description: "관광 설명",
              displayRole: "activity",
              iconKey: "landmark",
            },
            {
              heading: "호텔",
              description: "리이호텔",
              displayRole: "summary",
              iconKey: "hotel",
            },
            {
              heading: "식사",
              description: "[조식] 호텔식",
              displayRole: "summary",
              iconKey: "utensils",
            },
          ],
        },
      ],
    };

    const model = itineraryV2ToTimelineModel(v2);
    const events = model.days[0].events;
    expect(events[0].displayRole).toBe("activity");
    expect(events[1].displayRole).toBe("summary");
    expect(events[1].iconKey).toBe("hotel");
    expect(events[2].displayRole).toBe("summary");
    expect(events[2].iconKey).toBe("utensils");
  });
});
