import { describe, expect, it } from "vitest";
import {
  buildRecommendedAudienceBullets,
  shouldShowRecommendedAudience,
} from "@/lib/products/buildRecommendedAudienceBullets";
import type { Product } from "@/types/product";

function baseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    title: "테스트 상품",
    description: "설명",
    image_url: "https://example.com/a.jpg",
    category: "해외",
    ...overrides,
  };
}

describe("buildRecommendedAudienceBullets", () => {
  it("골프 테마와 일정에서 audience bullet을 파생한다", () => {
    const bullets = buildRecommendedAudienceBullets(
      baseProduct({ theme: "골프", duration: "3박4일" }),
    );
    expect(bullets).toContain("골프 여행을 계획 중인 분");
    expect(bullets).toContain("3박4일 일정을 찾는 분");
    expect(shouldShowRecommendedAudience(bullets)).toBe(true);
  });

  it("구간가가 없으면 주말·비수기 generic 문구를 넣지 않는다", () => {
    const bullets = buildRecommendedAudienceBullets(
      baseProduct({ duration: "2박3일", airline: "대한항공" }),
    );
    expect(bullets.some((b) => b.includes("주말"))).toBe(false);
    expect(bullets.some((b) => b.includes("비수기"))).toBe(false);
    expect(bullets).toContain("항공 포함 패키지를 원하는 분");
  });

  it("구간가가 있을 때만 해당 season bullet을 노출한다", () => {
    const bullets = buildRecommendedAudienceBullets(
      baseProduct({
        duration: "3박4일",
        seasonal_price_bands: { offSeason: 699000, weekend: null, peakSeason: null },
      }),
    );
    expect(bullets).toContain("비수기 가성비를 중요하게 보는 분");
    expect(bullets.some((b) => b.includes("주말"))).toBe(false);
  });

  it("highlights만 있을 때 highlight 파생 bullet을 만든다", () => {
    const bullets = buildRecommendedAudienceBullets(
      baseProduct({ highlights: ["온천", "미식"] }),
    );
    expect(bullets).toContain("온천 여행을 원하는 분");
    expect(bullets).toContain("미식 여행을 원하는 분");
  });

  it("bullet이 1개 이하면 섹션을 숨긴다", () => {
    const bullets = buildRecommendedAudienceBullets(baseProduct({ category: "기타" }));
    expect(shouldShowRecommendedAudience(bullets)).toBe(false);
  });
});
