import { describe, expect, it } from "vitest";
import type { Product } from "@/types/product";
import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";
import {
  buildCampaignRepresentativeBadges,
  getCampaignBadgePriority,
} from "@/lib/productCampaignBadges";
import { productToProductCardProps } from "@/lib/productCardProps";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    title: "T",
    description: "",
    image_url: "/i.jpg",
    category: "일본",
    ...overrides,
  };
}

function meta(partial: Partial<ProductCampaignCardMeta> & Pick<ProductCampaignCardMeta, "displayLabel">): ProductCampaignCardMeta {
  return {
    name: "n",
    badge_priority: partial.badge_priority ?? 1,
    badge_visible: partial.badge_visible ?? true,
    badge_tone: partial.badge_tone ?? "neutral",
    ...partial,
  };
}

describe("productCampaignBadges read policy", () => {
  it("A: campaign_card_meta 에 visible 이 있으면 meta 만 사용 (campaigns 무시)", () => {
    const product = baseProduct({
      campaigns: ["추천"],
      campaign_card_meta: [
        meta({ displayLabel: "CMS", badge_priority: 1, badge_visible: true, badge_tone: "primary" }),
      ],
    });
    const badges = buildCampaignRepresentativeBadges(product, { max: 2 });
    expect(badges.map((b) => b.label)).toEqual(["CMS"]);
  });

  it("B: meta 는 있으나 전부 badge_visible=false 이면 빈 배열", () => {
    const product = baseProduct({
      campaigns: ["추천"],
      campaign_card_meta: [meta({ displayLabel: "숨김", badge_visible: false })],
    });
    expect(buildCampaignRepresentativeBadges(product)).toEqual([]);
  });

  it("C: meta 가 없을 때만 campaigns / is_* fallback", () => {
    const product = baseProduct({
      campaigns: null,
      is_recommend: true,
    });
    expect(buildCampaignRepresentativeBadges(product, { max: 2 })[0]?.label).toBe("추천");
  });

  it("D: 레거시 라벨 우선순위 추천 > 인기 > 신규 > 기타", () => {
    expect(getCampaignBadgePriority("추천")).toBeLessThan(getCampaignBadgePriority("인기"));
    expect(getCampaignBadgePriority("인기")).toBeLessThan(getCampaignBadgePriority("신규"));
    expect(getCampaignBadgePriority("신규")).toBeLessThan(getCampaignBadgePriority("기타"));
    const product = baseProduct({ campaigns: ["신규", "인기", "추천"] });
    /** `buildCampaignRepresentativeBadges` 의 max 는 구현상 1~2로 클램프됨 */
    const labels = buildCampaignRepresentativeBadges(product, { max: 2 }).map((b) => b.label);
    expect(labels).toEqual(["추천", "인기"]);
  });

  it("E: max=1 과 max=2 결과 개수", () => {
    const product = baseProduct({
      campaign_card_meta: [
        meta({ displayLabel: "A", badge_priority: 1 }),
        meta({ displayLabel: "B", badge_priority: 2 }),
      ],
    });
    expect(buildCampaignRepresentativeBadges(product, { max: 1 })).toHaveLength(1);
    expect(buildCampaignRepresentativeBadges(product, { max: 2 })).toHaveLength(2);
  });

  it("F: productToProductCardProps — list/mobile 은 기본 max 1, 그 외 2", () => {
    const product = baseProduct({
      campaign_card_meta: [
        meta({ displayLabel: "A", badge_priority: 1 }),
        meta({ displayLabel: "B", badge_priority: 2 }),
      ],
    });
    const list = productToProductCardProps(product, { campaignPresentationKind: "list" });
    const mobile = productToProductCardProps(product, { campaignPresentationKind: "mobile" });
    const grid = productToProductCardProps(product, { layout: "grid" });
    expect(list.badges).toHaveLength(1);
    expect(mobile.badges).toHaveLength(1);
    expect(grid.badges).toHaveLength(2);
  });
});
