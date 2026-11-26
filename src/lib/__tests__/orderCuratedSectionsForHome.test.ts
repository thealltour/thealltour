import { describe, expect, it } from "vitest";
import { orderCuratedSectionsForHome } from "@/components/home/CuratedProductsSection";
import type { HomeCuratedSectionWithProducts } from "@/types/homeCurated";

function section(
  id: string,
  productCount: number,
  sort_order = 0,
): HomeCuratedSectionWithProducts {
  return {
    id,
    setting_id: "s1",
    title: id,
    description: "",
    sort_order,
    max_items: 8,
    is_active: true,
    products: Array.from({ length: productCount }, (_, i) => ({
      id: `${id}-p${i}`,
    })) as HomeCuratedSectionWithProducts["products"],
  };
}

describe("orderCuratedSectionsForHome", () => {
  it("puts sections with 4+ products first while preserving relative order", () => {
    const ordered = orderCuratedSectionsForHome([
      section("europe", 2, 0),
      section("family", 4, 1),
      section("asia", 1, 2),
      section("golf", 5, 3),
    ]);
    // 4개 이상끼리에서는 상품 수 내림차순, 그다음 원본 인덱스
    expect(ordered.map((s) => s.id)).toEqual(["golf", "family", "europe", "asia"]);
  });

  it("returns single section unchanged", () => {
    const only = [section("only", 2)];
    expect(orderCuratedSectionsForHome(only)).toEqual(only);
  });
});
