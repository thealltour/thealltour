/**
 * POST-UI-01D-3A: Home Golf slim calendar — legacy JS filter vs DB golf filter event parity.
 */

import { describe, expect, it } from "vitest";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import {
  buildHomeGolfChannelDbFilter,
  collectGolfProductLineIds,
  filterGolfChannelProducts,
  GOLF_PRESET_CATEGORIES,
  isGolfChannelProduct,
} from "@/lib/products/golfChannel";
import {
  buildGolfDepartureEvents,
  GOLF_CALENDAR_EXCLUDED_HEAVY_COLUMNS,
  GOLF_CALENDAR_PRODUCT_SELECT,
  mapRowToGolfCalendarEventSource,
  type GolfCalendarEventSource,
} from "@/lib/products/golfDepartureCalendar";
import {
  HOME_GOLF_CALENDAR_CHUNK_SIZE,
} from "@/lib/products/getGolfDepartureCalendarProducts";
import { buildTaxonomyNameMap } from "@/lib/productTaxonomies";
import { buildGolfOrFilter } from "@/lib/products/productListingQuery";

const PROMO_ID = "11111111-1111-4111-8111-111111111111";

const productLines: ProductTaxonomy[] = [
  {
    id: "pl-golf",
    name: "골프투어",
    slug: "golf-tour",
    taxonomy_type: "product_line",
    is_active: true,
    sort_order: 1,
    created_at: null,
    is_hub_visible: true,
    is_landing_enabled: false,
  },
  {
    id: "pl-park",
    name: "파크골프투어",
    slug: "park-golf",
    taxonomy_type: "product_line",
    is_active: true,
    sort_order: 2,
    created_at: null,
    is_hub_visible: true,
    is_landing_enabled: false,
  },
  {
    id: "pl-pkg",
    name: "패키지관광",
    slug: "package",
    taxonomy_type: "product_line",
    is_active: true,
    sort_order: 3,
    created_at: null,
    is_hub_visible: true,
    is_landing_enabled: false,
  },
];

const destinations: ProductTaxonomy[] = [
  {
    id: "dest-jp",
    name: "일본",
    slug: "japan",
    taxonomy_type: "destination",
    is_active: true,
    sort_order: 1,
    created_at: null,
    is_hub_visible: true,
    is_landing_enabled: true,
  },
];

function product(
  partial: Partial<Product> & Pick<Product, "id" | "title">,
): Product {
  return {
    id: partial.id,
    title: partial.title,
    category: partial.category ?? "일본",
    theme: partial.theme,
    product_line_id: partial.product_line_id,
    destination_id: partial.destination_id,
    price: partial.price,
    image_url: partial.image_url,
    overview_region: partial.overview_region,
    departure_from_date: partial.departure_from_date,
    departure_to_date: partial.departure_to_date,
    departures: partial.departures,
    departureSchedules: partial.departureSchedules,
    campaigns_json: partial.campaigns_json,
    description: partial.description ?? "heavy description should not affect events",
  } as Product;
}

function productToCalendarRow(p: Product): Record<string, unknown> {
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    destination_id: p.destination_id ?? null,
    product_line_id: p.product_line_id ?? null,
    category: p.category ?? null,
    theme: p.theme ?? null,
    overview_region: p.overview_region ?? null,
    image_url: p.image_url ?? null,
    images_json: p.images_json ?? null,
    departure_schedules_json: p.departureSchedules ?? null,
    departure_from_date: p.departure_from_date ?? null,
    departure_to_date: p.departure_to_date ?? null,
    campaigns_json: p.campaigns_json ?? null,
  };
}

function dbGolfFilterMatches(
  source: Pick<GolfCalendarEventSource, "product_line_id" | "category">,
  productLineIds: string[],
  legacyCategories: readonly string[],
): boolean {
  const lineId = source.product_line_id?.trim();
  if (lineId && productLineIds.includes(lineId)) return true;
  const cat = (source.category ?? "").trim();
  return legacyCategories.some((c) => c === cat);
}

function legacyHomeEvents(catalog: Product[]): ReturnType<typeof buildGolfDepartureEvents> {
  const productLineNameMap = buildTaxonomyNameMap(productLines);
  const destinationNameMap = buildTaxonomyNameMap(destinations);
  const golfProducts = filterGolfChannelProducts(catalog, productLineNameMap);
  return buildGolfDepartureEvents(golfProducts, destinationNameMap, PROMO_ID);
}

function slimHomeEvents(catalog: Product[]): ReturnType<typeof buildGolfDepartureEvents> {
  const { productLineIds, legacyCategories } = buildHomeGolfChannelDbFilter(productLines);
  const destinationNameMap = buildTaxonomyNameMap(destinations);
  const sources = catalog
    .map((p) => mapRowToGolfCalendarEventSource(productToCalendarRow(p)))
    .filter((s) => dbGolfFilterMatches(s, productLineIds, legacyCategories));
  return buildGolfDepartureEvents(sources, destinationNameMap, PROMO_ID);
}

describe("GOLF_CALENDAR_PRODUCT_SELECT projection", () => {
  it("includes product_line_id and excludes heavy PDP fields", () => {
    const cols = GOLF_CALENDAR_PRODUCT_SELECT.split(",");
    expect(cols).toContain("product_line_id");
    expect(cols).not.toContain("campaigns");
    for (const heavy of GOLF_CALENDAR_EXCLUDED_HEAVY_COLUMNS) {
      expect(cols).not.toContain(heavy);
    }
  });
});

describe("Home Golf DB filter helpers", () => {
  it("collectGolfProductLineIds matches golf taxonomies only", () => {
    expect(collectGolfProductLineIds(productLines)).toEqual(["pl-golf", "pl-park"]);
  });

  it("buildGolfOrFilter includes product_line and legacy categories", () => {
    const filter = buildHomeGolfChannelDbFilter(productLines);
    const or = buildGolfOrFilter({
      productLineIds: filter.productLineIds,
      legacyCategories: [...filter.legacyCategories],
    });
    expect(or).toContain("product_line_id.in.");
    expect(or).toContain("pl-golf");
    expect(or).toContain(`category.in.("${GOLF_PRESET_CATEGORIES[0]}","${GOLF_PRESET_CATEGORIES[1]}")`);
  });

  it("HOME_GOLF_CALENDAR_CHUNK_SIZE is 500", () => {
    expect(HOME_GOLF_CALENDAR_CHUNK_SIZE).toBe(500);
  });
});

describe("legacy-vs-slim Home Golf exact event parity", () => {
  const catalog = [
    product({
      id: "golf-line",
      title: "골프 라인",
      product_line_id: "pl-golf",
      category: "일본",
      departure_from_date: "2026-10-01",
      price: 1200000,
      campaigns_json: [PROMO_ID],
    }),
    product({
      id: "legacy-cat",
      title: "레거시 카테고리",
      category: "파크골프투어",
      departure_from_date: "2026-10-05",
      price: 900000,
    }),
    product({
      id: "package-only",
      title: "일반 패키지",
      product_line_id: "pl-pkg",
      category: "일본",
      theme: "가족여행",
      departure_from_date: "2026-11-01",
    }),
    product({
      id: "theme-golf-only",
      title: "테마만 골프",
      category: "일본",
      theme: "골프",
      departure_from_date: "2026-11-02",
    }),
    product({
      id: "window-expand",
      title: "기간 확장",
      product_line_id: "pl-golf",
      category: "일본",
      departure_from_date: "2026-12-01",
      departure_to_date: "2026-12-03",
    }),
    product({
      id: "sold-out-sched",
      title: "SOLD OUT 일정",
      product_line_id: "pl-golf",
      category: "일본",
      departureSchedules: [
        { departureDate: "2026-12-10", status: "SOLD_OUT", price: 990000 },
      ],
    }),
  ];

  it("exact event sequence matches legacy filterGolfChannelProducts path", () => {
    expect(slimHomeEvents(catalog)).toEqual(legacyHomeEvents(catalog));
  });

  it("excludes non-golf and theme-only products", () => {
    const legacy = legacyHomeEvents(catalog);
    const ids = new Set(legacy.map((e) => e.productId));
    expect(ids.has("package-only")).toBe(false);
    expect(ids.has("theme-golf-only")).toBe(false);
    expect(ids.has("golf-line")).toBe(true);
    expect(ids.has("legacy-cat")).toBe(true);
  });

  it("promotion flag parity via campaigns_json token", () => {
    const events = slimHomeEvents(catalog);
    const promoEvents = events.filter((e) => e.productId === "golf-line");
    expect(promoEvents.some((e) => e.isPromotionDeparture)).toBe(true);
  });

  it("theme-only product is not golf channel", () => {
    const p = product({ id: "t1", title: "T", category: "일본", theme: "골프" });
    expect(isGolfChannelProduct(p, buildTaxonomyNameMap(productLines))).toBe(false);
  });
});

describe("getHomeGolfDepartureCalendarEventSources source contract", () => {
  it("module does not call getProducts or normalizeProduct", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const source = readFileSync(
      resolve(process.cwd(), "src/lib/products/getGolfDepartureCalendarProducts.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/import\s*\{[^}]*\bgetProducts\b/);
    expect(source).not.toMatch(/await getProducts\(/);
    expect(source).not.toMatch(/\.select\(\s*["']\*["']\s*\)/);
    expect(source).not.toMatch(/\bnormalizeProduct\s*\(/);
  });
});
