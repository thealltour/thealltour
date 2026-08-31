import { describe, expect, it } from "vitest";
import {
  buildGolfCalendarListingFilters,
} from "@/lib/products/getGolfDepartureCalendarProducts";
import {
  buildGolfDepartureEvents,
  mapRowToGolfCalendarEventSource,
} from "@/lib/products/golfDepartureCalendar";
import { GOLF_TOUR_TYPE } from "@/lib/products/golfChannel";
import { PRODUCT_LIST_PAGE_SIZE } from "@/lib/products/productListingQuery";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { GolfCalendarEventSource } from "@/lib/products/golfDepartureCalendar";

function tax(
  partial: Partial<ProductTaxonomy> & Pick<ProductTaxonomy, "id" | "name" | "taxonomy_type">,
): ProductTaxonomy {
  return {
    slug: null,
    is_active: true,
    sort_order: 0,
    created_at: null,
    parent_id: null,
    is_hub_visible: true,
    is_landing_enabled: true,
    ...partial,
  };
}

const destinations = [
  tax({ id: "jp", name: "일본", taxonomy_type: "destination" }),
  tax({ id: "osaka", name: "오사카", taxonomy_type: "destination", parent_id: "jp" }),
  tax({ id: "sea", name: "동남아", taxonomy_type: "destination" }),
  tax({ id: "vn", name: "베트남", taxonomy_type: "destination", parent_id: "sea" }),
];

const themes = [
  tax({ id: "family", name: "가족여행", taxonomy_type: "theme" }),
  tax({ id: "kids", name: "아이동반", taxonomy_type: "theme", parent_id: "family" }),
];

const productLines = [
  tax({ id: "pl-golf", name: "골프투어", taxonomy_type: "product_line", slug: "golf-tour" }),
  tax({ id: "pl-park", name: "파크골프투어", taxonomy_type: "product_line", slug: "park-golf" }),
  tax({ id: "pl-pkg", name: "패키지관광", taxonomy_type: "product_line" }),
];

const taxonomy = {
  destinations,
  themes,
  productLines,
  campaignNamesByCollection: {
    recommend: ["추천캠페인"],
    popular: ["인기캠페인"],
  },
};

function golfProduct(
  partial: Partial<GolfCalendarEventSource> & Pick<GolfCalendarEventSource, "id" | "title">,
): GolfCalendarEventSource {
  return {
    category: "골프",
    ...partial,
  };
}

describe("buildGolfCalendarListingFilters", () => {
  it("applies golf channel for tourType=golf-park", () => {
    const filters = buildGolfCalendarListingFilters({
      filters: { tourType: GOLF_TOUR_TYPE },
      taxonomy,
    });
    expect(filters.golfChannel?.productLineIds).toContain("pl-golf");
    expect(filters.golfChannel?.legacyCategories?.length).toBeGreaterThan(0);
  });

  it("page and sort do not change calendar filters", () => {
    const base = {
      tourType: GOLF_TOUR_TYPE,
      region: "일본",
      theme: "가족여행",
      product_line: "골프투어",
      collection: "recommend",
    };
    const a = buildGolfCalendarListingFilters({
      filters: { ...base, page: 1, pageSize: 24, sort: "latest" },
      taxonomy,
    });
    const b = buildGolfCalendarListingFilters({
      filters: { ...base, page: 3, pageSize: 24, sort: "price_asc" },
      taxonomy,
    });
    expect(a).toEqual(b);
    expect(a.destinationScope?.ids).toContain("osaka");
    expect(a.themeNames).toContain("아이동반");
    expect(a.productLineId).toBe("pl-golf");
    expect(a.collection?.kind).toBe("recommend");
  });

  it("region 일본 vs 동남아 → different destinationScope", () => {
    const jp = buildGolfCalendarListingFilters({
      filters: { tourType: GOLF_TOUR_TYPE, region: "일본" },
      taxonomy,
    });
    const sea = buildGolfCalendarListingFilters({
      filters: { tourType: GOLF_TOUR_TYPE, region: "동남아" },
      taxonomy,
    });
    expect(jp.destinationScope?.ids).toContain("osaka");
    expect(jp.destinationScope?.ids).not.toContain("vn");
    expect(sea.destinationScope?.ids).toContain("vn");
    expect(sea.destinationScope?.ids).not.toContain("osaka");
  });

  it("golfRegion preset applies destinationScope when region empty", () => {
    const filters = buildGolfCalendarListingFilters({
      filters: { tourType: GOLF_TOUR_TYPE, golfRegion: "japan-china" },
      taxonomy,
    });
    expect(filters.destinationScope?.ids?.length ?? 0).toBeGreaterThan(0);
    expect(filters.destinationScope?.ids).toContain("jp");
  });
});

describe("25th-product calendar universe (page independence)", () => {
  it("page-sized slice misses 25th departure; full universe includes it", () => {
    const products: GolfCalendarEventSource[] = Array.from({ length: 25 }, (_, i) =>
      golfProduct({
        id: `g-${i + 1}`,
        title: `골프 ${i + 1}`,
        departures: i === 24 ? ["2026-10-15"] : [`2026-09-${String((i % 28) + 1).padStart(2, "0")}`],
      }),
    );

    expect(PRODUCT_LIST_PAGE_SIZE).toBe(24);
    const page1Slice = products.slice(0, PRODUCT_LIST_PAGE_SIZE);
    const page1Events = buildGolfDepartureEvents(page1Slice);
    const fullEvents = buildGolfDepartureEvents(products);

    expect(page1Events.some((e) => e.date === "2026-10-15")).toBe(false);
    expect(fullEvents.some((e) => e.date === "2026-10-15")).toBe(true);
    expect(fullEvents.some((e) => e.productId === "g-25")).toBe(true);
  });

  it("same full product set → identical event dates for page=1 vs page=2 listing slices", () => {
    const products: GolfCalendarEventSource[] = Array.from({ length: 30 }, (_, i) =>
      golfProduct({
        id: `p-${i}`,
        title: `상품 ${i}`,
        departures: [`2026-11-${String((i % 28) + 1).padStart(2, "0")}`],
      }),
    );
    const universe = buildGolfDepartureEvents(products);
    const datesA = universe.map((e) => `${e.productId}:${e.date}`).sort();
    const datesB = buildGolfDepartureEvents(products).map((e) => `${e.productId}:${e.date}`).sort();
    expect(datesA).toEqual(datesB);
    // Listing slices differ; calendar must not use them
    expect(products.slice(0, 24).map((p) => p.id)).not.toEqual(
      products.slice(24, 48).map((p) => p.id),
    );
  });
});

describe("mapRowToGolfCalendarEventSource", () => {
  it("maps slim DB row without full Product normalize", () => {
    const source = mapRowToGolfCalendarEventSource({
      id: "abc",
      title: "베트남 골프",
      price: 990000,
      destination_id: "vn",
      category: "베트남",
      theme: "골프",
      overview_region: "다낭",
      image_url: "https://example.com/a.jpg",
      images_json: ["https://example.com/a.jpg"],
      departure_schedules_json: [
        { departureDate: "2026-12-01", status: "SOLD_OUT", price: 990000 },
      ],
      departure_from_date: null,
      departure_to_date: null,
      campaigns_json: ["promo-1"],
      campaigns: ["promo-1"],
    });
    expect(source.id).toBe("abc");
    expect(source.departureSchedules?.[0]?.status).toBe("SOLD_OUT");
    expect(source.campaigns_json).toEqual(["promo-1"]);
    const events = buildGolfDepartureEvents([source], {}, "promo-1");
    expect(events).toHaveLength(1);
    expect(events[0]?.date).toBe("2026-12-01");
    expect(events[0]?.isPromotionDeparture).toBe(true);
  });
});
