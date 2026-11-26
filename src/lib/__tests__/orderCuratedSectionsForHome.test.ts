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
  it("keeps admin order when the first section already has 4+ products [4, 5, 2]", () => {
    const input = [
      section("a", 4, 0),
      section("b", 5, 1),
      section("c", 2, 2),
    ];
    expect(orderCuratedSectionsForHome(input).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("moves only the first 4+ section to the front when the lead is short [2, 4, 5, 1]", () => {
    const ordered = orderCuratedSectionsForHome([
      section("a", 2, 0),
      section("b", 4, 1),
      section("c", 5, 2),
      section("d", 1, 3),
    ]);
    expect(ordered.map((s) => s.id)).toEqual(["b", "a", "c", "d"]);
  });

  it("keeps admin order when no section has 4+ products [2, 3, 1]", () => {
    const input = [
      section("a", 2, 0),
      section("b", 3, 1),
      section("c", 1, 2),
    ];
    expect(orderCuratedSectionsForHome(input).map((s) => s.id)).toEqual(["a", "b", "c"]);
  });

  it("returns single section unchanged", () => {
    const only = [section("only", 2)];
    expect(orderCuratedSectionsForHome(only)).toEqual(only);
  });
});
