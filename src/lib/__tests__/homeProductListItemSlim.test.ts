import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import { productToProductCardProps } from "@/lib/productCardProps";
import { normalizeProduct } from "@/lib/products";
import {
  mapProductRowToListItem,
  PRODUCT_LISTING_EXCLUDED_HEAVY_COLUMNS,
  PRODUCT_LISTING_SELECT,
  type ProductListItem,
} from "@/lib/products/productListItem";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

const HOME_CURATED_SOURCE = readFileSync(
  resolve(process.cwd(), "src/lib/homeCurated.ts"),
  "utf8",
);
const HOME_GOLF_TOUR_SOURCE = readFileSync(
  resolve(process.cwd(), "src/lib/homeGolfTourProducts.ts"),
  "utf8",
);

const CAMPAIGN_TAX: ProductTaxonomy[] = [
  {
    id: "camp-1",
    taxonomy_type: "campaign",
    name: "추천",
    display_label: "추천 여행",
    badge_priority: 1,
    badge_visible: true,
    badge_tone: "primary",
    slug: "recommend",
  },
  {
    id: "camp-2",
    taxonomy_type: "campaign",
    name: "제철",
    display_label: "제철 특가",
    badge_priority: 2,
    badge_visible: true,
    badge_tone: "promotion",
    slug: "seasonal",
  },
];

const FULL_DB_ROW: Record<string, unknown> = {
  id: "home-card-1",
  title: "오사카 골프 4박5일",
  price: 1290000,
  seasonal_price_bands: { off_season: 990000, weekend: 1190000, peak_season: 1490000 },
  price_meta: "1인 기준",
  duration: "4박5일",
  category: "일본",
  theme: "골프 / 온천",
  meta_title: "#골프 #온천",
  status: "AVAILABLE",
  campaigns_json: ["추천", "제철"],
  image_url: "https://cdn.example/cover.jpg",
  images_json: ["https://cdn.example/cover.jpg", "https://cdn.example/gallery.jpg"],
  meta_info: "4성급 호텔 · 조식 포함",
  one_liner: "가성비 프리미엄 골프",
  overview_accommodation: "4성급 호텔",
  overview_region: "오사카",
  overview_duration: "4박5일",
  departure_from_date: "2026-09-01",
  departure_schedules_json: [{ departureDate: "2026-10-01", status: "AVAILABLE" }],
  destination_id: "dest-osaka",
  description: "PDP-only long description blob",
  itinerary: "Day1 … Day5",
  package_catalog_json: [{ id: "pkg-1", name: "Standard" }],
  golf_courses_json: [{ name: "ABC Golf" }],
  selling_points_json: ["포인트1"],
  options: { groups: [] },
  notes: "internal notes",
};

function pickListingRow(row: Record<string, unknown>): Record<string, unknown> {
  const keys = PRODUCT_LISTING_SELECT.split(",");
  const out: Record<string, unknown> = {};
  for (const key of keys) {
    if (key in row) out[key] = row[key];
  }
  return out;
}

/** homeGolfTourProducts / homeCurated shared configured-order restore */
function restoreConfiguredProductOrder<T extends { id: string }>(
  orderedIds: string[],
  items: T[],
  maxItems?: number,
): T[] {
  const productMap = new Map(items.map((p) => [p.id, p]));
  const restored = orderedIds
    .map((id) => productMap.get(id))
    .filter((p): p is T => p != null);
  return maxItems != null ? restored.slice(0, maxItems) : restored;
}

function cardPropsForHome(product: ProductListItem) {
  return productToProductCardProps(product, { campaignPresentationKind: "home" });
}

describe("homeCurated source contract", () => {
  it("uses PRODUCT_LISTING_SELECT without products.select(*) or normalizeProduct", () => {
    expect(HOME_CURATED_SOURCE).toContain("PRODUCT_LISTING_SELECT");
    expect(HOME_CURATED_SOURCE).toContain("mapProductRowToListItem");
    expect(HOME_CURATED_SOURCE).toContain("hydrateProductsWithCampaignCardMeta");
    expect(HOME_CURATED_SOURCE).not.toMatch(/from\("products"\)[\s\S]*?\.select\(\s*["']\*["']\s*\)/);
    expect(HOME_CURATED_SOURCE).not.toMatch(/\bnormalizeProduct\s*\(/);
  });

  it("excludes heavy PDP columns from listing projection", () => {
    for (const key of PRODUCT_LISTING_EXCLUDED_HEAVY_COLUMNS) {
      expect(PRODUCT_LISTING_SELECT).not.toContain(key);
    }
  });
});

describe("homeGolfTourProducts source contract", () => {
  it("uses PRODUCT_LISTING_SELECT without products.select(*) or normalizeProduct", () => {
    expect(HOME_GOLF_TOUR_SOURCE).toContain("PRODUCT_LISTING_SELECT");
    expect(HOME_GOLF_TOUR_SOURCE).toContain("mapProductRowToListItem");
    expect(HOME_GOLF_TOUR_SOURCE).toContain("hydrateProductsWithCampaignCardMeta");
    expect(HOME_GOLF_TOUR_SOURCE).not.toMatch(/from\("products"\)[\s\S]*?\.select\(\s*["']\*["']\s*\)/);
    expect(HOME_GOLF_TOUR_SOURCE).not.toMatch(/\bnormalizeProduct\s*\(/);
  });

  it("keeps MAX_HOME_GOLF_PRODUCTS cap at 20", () => {
    expect(HOME_GOLF_TOUR_SOURCE).toMatch(/MAX_HOME_GOLF_PRODUCTS\s*=\s*20/);
    expect(HOME_GOLF_TOUR_SOURCE).toContain(".slice(0, MAX_HOME_GOLF_PRODUCTS)");
  });
});

describe("configured order restore", () => {
  const dbItems = [
    { id: "A", title: "A" },
    { id: "B", title: "B" },
    { id: "C", title: "C" },
  ];

  it("home golf rail: [C, A, B] settings order survives DB [A, B, C] return", () => {
    const orderedIds = ["C", "A", "B"];
    const result = restoreConfiguredProductOrder(orderedIds, dbItems);
    expect(result.map((p) => p.id)).toEqual(["C", "A", "B"]);
  });

  it("home curated section: max_items default slice preserved", () => {
    const orderedIds = ["C", "A", "B", "A"];
    const result = restoreConfiguredProductOrder(orderedIds, dbItems, 2);
    expect(result.map((p) => p.id)).toEqual(["C", "A"]);
  });

  it("missing/inactive ids are skipped without throw", () => {
    const orderedIds = ["C", "missing", "A"];
    const result = restoreConfiguredProductOrder(orderedIds, dbItems);
    expect(result.map((p) => p.id)).toEqual(["C", "A"]);
  });
});

describe("home curated vs golf rail card parity", () => {
  function buildLegacyFullProduct() {
    const full = normalizeProduct(FULL_DB_ROW);
    const [hydrated] = hydrateProductsWithCampaignCardMeta([full], CAMPAIGN_TAX);
    return hydrated;
  }

  function buildSlimListItem() {
    const listingRow = pickListingRow(FULL_DB_ROW);
    const item = mapProductRowToListItem(listingRow);
    const [hydrated] = hydrateProductsWithCampaignCardMeta([item], CAMPAIGN_TAX);
    return hydrated;
  }

  it("productToProductCardProps parity: full Product vs slim ProductListItem", () => {
    const legacy = buildLegacyFullProduct();
    const slim = buildSlimListItem();

    const legacyProps = cardPropsForHome(legacy);
    const slimProps = cardPropsForHome(slim);

    expect(slimProps.id).toBe(legacyProps.id);
    expect(slimProps.title).toBe(legacyProps.title);
    expect(slimProps.price).toBe(legacyProps.price);
    expect(slimProps.priceMeta).toBe(legacyProps.priceMeta);
    expect(slimProps.seasonal_price_bands).toEqual(legacyProps.seasonal_price_bands);
    expect(slimProps.thumbnailUrl).toBe(legacyProps.thumbnailUrl);
    expect(slimProps.duration).toBe(legacyProps.duration);
    expect(slimProps.region).toBe(legacyProps.region);
    expect(slimProps.oneLiner).toBe(legacyProps.oneLiner);
    expect(slimProps.metaInfo).toBe(legacyProps.metaInfo);
    expect(slimProps.status).toBe(legacyProps.status);
    expect(slimProps.hrefDetail).toBe(legacyProps.hrefDetail);
    expect(slimProps.badges).toEqual(legacyProps.badges);
    expect(slimProps.ratingAvg).toBe(legacyProps.ratingAvg);
    expect(slimProps.reviewCount).toBe(legacyProps.reviewCount);
  });

  it("campaign badge parity on hydrated slim rows", () => {
    const legacy = buildLegacyFullProduct();
    const slim = buildSlimListItem();
    expect(slim.campaign_card_meta?.some((m) => m.displayLabel === "추천 여행")).toBe(true);
    expect(slim.campaign_card_meta?.some((m) => m.displayLabel === "제철 특가")).toBe(true);
    expect(cardPropsForHome(slim).badges).toEqual(cardPropsForHome(legacy).badges);
  });

  it("primary image selection parity", () => {
    const legacy = buildLegacyFullProduct();
    const slim = buildSlimListItem();
    expect(cardPropsForHome(slim).thumbnailUrl).toBe(cardPropsForHome(legacy).thumbnailUrl);
  });

  it("seasonal price metadata parity", () => {
    const legacy = buildLegacyFullProduct();
    const slim = buildSlimListItem();
    expect(cardPropsForHome(slim).seasonal_price_bands).toEqual(
      cardPropsForHome(legacy).seasonal_price_bands,
    );
  });
});

describe("Home Golf Calendar regression guard", () => {
  it("homeGolfTourProducts does not import calendar module", () => {
    expect(HOME_GOLF_TOUR_SOURCE).not.toContain("golfDepartureCalendar");
    expect(HOME_GOLF_TOUR_SOURCE).not.toContain("getHomeGolfDepartureCalendar");
  });
});
