import { describe, expect, it } from "vitest";
import { resolveHomeCuratedSectionTitle } from "@/lib/homeCuratedSectionTitle";
import type {
  HomeCuratedSectionWithProducts,
  HomeCuratedSettings,
} from "@/types/homeCurated";

function settings(overrides: Partial<HomeCuratedSettings> = {}): HomeCuratedSettings {
  return {
    id: "s1",
    setting_key: "home_curated",
    section_label: "",
    section_title: "",
    section_description: "",
    catalog_button_label: "",
    catalog_button_href: "/products",
    is_active: true,
    ...overrides,
  };
}

function section(title: string): HomeCuratedSectionWithProducts {
  return {
    id: "sec1",
    setting_id: "s1",
    title,
    description: "",
    sort_order: 0,
    max_items: 8,
    is_active: true,
    products: [],
  };
}

describe("resolveHomeCuratedSectionTitle", () => {
  it("uses settings.section_title when present", () => {
    expect(
      resolveHomeCuratedSectionTitle(
        settings({ section_title: "THEALL PICKS" }),
        [section("유럽 여행 상품")],
      ),
    ).toBe("THEALL PICKS");
  });

  it("falls back to single section title when settings title empty", () => {
    expect(resolveHomeCuratedSectionTitle(settings(), [section("유럽 여행 상품")])).toBe(
      "유럽 여행 상품",
    );
  });

  it("falls back to section_label then default for multiple sections", () => {
    expect(
      resolveHomeCuratedSectionTitle(settings({ section_label: "CURATED" }), [
        section("유럽 여행 상품"),
        section("동남아 여행"),
      ]),
    ).toBe("CURATED");
    expect(
      resolveHomeCuratedSectionTitle(settings(), [section("유럽"), section("동남아")]),
    ).toBe("추천 여행");
  });
});
