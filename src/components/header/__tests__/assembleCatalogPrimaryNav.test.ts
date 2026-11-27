import { describe, expect, it } from "vitest";
import { assembleCatalogPrimaryNav } from "@/components/header/assembleCatalogPrimaryNav";
import type { HeaderPrimaryNavItem } from "@/components/header/headerNav.types";

const baseNav: HeaderPrimaryNavItem[] = [
  { key: "recommended", label: "여행추천", href: "/recommended", groups: [] },
  { key: "region", label: "지역별 여행", href: "/destinations", groups: [] },
  { key: "theme", label: "테마별", href: "/themes", groups: [] },
  { key: "inquiry", label: "legacy", href: "/quote" },
  { key: "planner", label: "여행플래너", href: "/planner" },
];

describe("assembleCatalogPrimaryNav corporate inquiry", () => {
  it("expands inquiry into corporate hub link with child leaves", () => {
    const nav = assembleCatalogPrimaryNav(baseNav);
    const inquiry = nav.find((item) => item.key === "inquiry");
    expect(inquiry).toMatchObject({
      label: "기업·단체여행",
      href: "/corporate",
    });
    expect(inquiry?.groups?.[0]?.items.map((leaf) => leaf.label)).toEqual([
      "기업",
      "공기업",
      "공공기관",
      "의회",
      "기업·기관 견적",
      "가족·동호회 단체 견적",
    ]);
    expect(inquiry?.groups?.[0]?.items.find((leaf) => leaf.key === "family-group-quote")?.href).toBe(
      "/quote",
    );
  });
});
