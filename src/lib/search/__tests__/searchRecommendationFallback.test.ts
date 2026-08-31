/**
 * POST-UI-01D-2B-2: Search recommendation fallback uses listing projection.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_LISTING_SELECT } from "@/lib/products/productListItem";

const SOURCE = readFileSync(
  resolve(process.cwd(), "src/lib/search/getSearchRecommendations.ts"),
  "utf8",
);

describe("getSearchRecommendations fallback slim projection", () => {
  it("fallback uses PRODUCT_LISTING_SELECT", () => {
    expect(SOURCE).toContain("PRODUCT_LISTING_SELECT");
    expect(SOURCE).toContain(".select(PRODUCT_LISTING_SELECT)");
  });

  it("fallback has no select(\"*\")", () => {
    expect(SOURCE).not.toMatch(/\.select\(\s*["']\*["']\s*\)/);
  });

  it("fallback has no normalizeProduct", () => {
    expect(SOURCE).not.toContain("normalizeProduct");
  });

  it("uses mapProductRowToListItem", () => {
    expect(SOURCE).toContain("mapProductRowToListItem");
  });

  it("keeps JS excludeIds (no .not in)", () => {
    expect(SOURCE).toContain("excludeIds.has");
    expect(SOURCE).not.toMatch(/\.not\(\s*["']id["']/);
  });

  it("preserves catalog order and limit formula", () => {
    expect(SOURCE).toContain('order("sort_order"');
    expect(SOURCE).toContain('order("created_at"');
    expect(SOURCE).toContain("MAX_PRODUCTS + opts.excludeIds.size");
  });

  it("preserves campaign hydration", () => {
    expect(SOURCE).toContain("hydrateProductsWithCampaignCardMeta");
    expect(SOURCE).toContain("getCampaignTaxonomiesForCard");
  });

  it("PRODUCT_LISTING_SELECT is the shared listing constant", () => {
    expect(PRODUCT_LISTING_SELECT).toContain("title");
    expect(PRODUCT_LISTING_SELECT).toContain("campaigns_json");
    expect(PRODUCT_LISTING_SELECT).not.toContain("description");
  });
});

describe("suggestions route slim source", () => {
  const route = readFileSync(
    resolve(process.cwd(), "src/app/api/products/suggestions/route.ts"),
    "utf8",
  );

  it("does not call getProducts", () => {
    expect(route).not.toContain("getProducts");
  });

  it("uses getProductSuggestionItems helper", () => {
    expect(route).toContain("getProductSuggestionItems");
  });
});
