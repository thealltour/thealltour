import { describe, expect, it } from "vitest";
import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";
import { sortVisibleCampaignCardMeta } from "@/lib/productCampaignSort";

function meta(
  partial: Partial<ProductCampaignCardMeta> & Pick<ProductCampaignCardMeta, "displayLabel">,
): ProductCampaignCardMeta {
  return {
    name: "n",
    badge_priority: partial.badge_priority ?? 100,
    badge_visible: partial.badge_visible ?? true,
    badge_tone: partial.badge_tone ?? "neutral",
    ...partial,
  };
}

describe("sortVisibleCampaignCardMeta", () => {
  it("badge_priority 오름차순, 동점 시 displayLabel", () => {
    const sorted = sortVisibleCampaignCardMeta([
      meta({ displayLabel: "시즌 / 특가", badge_priority: 100, isPromotionCampaign: true }),
      meta({ displayLabel: "추천", badge_priority: 1 }),
      meta({ displayLabel: "인기", badge_priority: 2 }),
      meta({ displayLabel: "신규", badge_priority: 3 }),
    ]);
    expect(sorted.map((m) => m.displayLabel)).toEqual(["추천", "인기", "신규", "시즌 / 특가"]);
  });

  it("badge_visible=false 항목 제외", () => {
    const sorted = sortVisibleCampaignCardMeta([
      meta({ displayLabel: "숨김", badge_priority: 0, badge_visible: false }),
      meta({ displayLabel: "노출", badge_priority: 5 }),
    ]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0]?.displayLabel).toBe("노출");
  });

  it("미설정 priority는 100으로 취급", () => {
    const sorted = sortVisibleCampaignCardMeta([
      meta({ displayLabel: "A", badge_priority: 50 }),
      meta({ displayLabel: "B" }),
    ]);
    expect(sorted.map((m) => m.displayLabel)).toEqual(["A", "B"]);
  });
});
