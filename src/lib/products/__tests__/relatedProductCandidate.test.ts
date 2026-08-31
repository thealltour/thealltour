/**
 * POST-UI-01D-2B-1: Related full-slim candidate parity + projection tests.
 */

import { describe, expect, it } from "vitest";
import type { Product } from "@/types/product";
import type { ProductCampaignCardMeta } from "@/types/productCampaignCard";
import { getRelatedProducts } from "@/lib/products/getRelatedProducts";
import {
  MIN_RELATED_SCORE,
  scoreRelatedProduct,
  sortRelatedProducts,
  type RelatedScorableProduct,
} from "@/lib/products/relatedProductScoring";
import {
  RELATED_CANDIDATE_CHUNK_SIZE,
  RELATED_CANDIDATE_COLUMN_KEYS,
  RELATED_CANDIDATE_EXCLUDED_COLUMNS,
  RELATED_CANDIDATE_SELECT,
  mapRowToRelatedCandidate,
  relatedStage2ListingSelect,
  restoreRelatedProductListItemOrderByIds,
  type RelatedCandidate,
} from "@/lib/products/relatedProductCandidate";
import {
  PRODUCT_LISTING_EXCLUDED_HEAVY_COLUMNS,
  PRODUCT_LISTING_SELECT,
  type ProductListItem,
} from "@/lib/products/productListItem";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

const REF = new Date("2026-08-31T12:00:00.000Z");

function promoMeta(): ProductCampaignCardMeta {
  return {
    name: "promotion",
    displayLabel: "시즌 / 특가",
    badge_priority: 1,
    badge_visible: true,
    badge_tone: "neutral",
    isPromotionCampaign: true,
  };
}

function fullProduct(overrides: Partial<Product> & { id: string }): Product {
  return {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    description: overrides.description ?? "heavy description blob",
    image_url: overrides.image_url ?? "/i.jpg",
    category: overrides.category,
    theme: overrides.theme,
    destination_id: overrides.destination_id,
    product_line_id: overrides.product_line_id,
    created_at: overrides.created_at,
    is_popular: overrides.is_popular,
    is_recommend: overrides.is_recommend,
    campaign_card_meta: overrides.campaign_card_meta,
    campaigns_json: overrides.campaigns_json,
    price: overrides.price ?? 100000,
  } as Product;
}

function slimCandidate(
  overrides: Partial<RelatedCandidate> & { id: string },
): RelatedCandidate {
  return mapRowToRelatedCandidate({
    id: overrides.id,
    destination_id: overrides.destination_id ?? null,
    product_line_id: overrides.product_line_id ?? null,
    category: overrides.category ?? null,
    theme: overrides.theme ?? null,
    created_at: overrides.created_at ?? null,
    campaigns_json: overrides.campaigns_json,
    campaign_card_meta: overrides.campaign_card_meta,
    is_popular: overrides.is_popular,
    is_recommend: overrides.is_recommend,
  });
}

/** Same score fields on full Product vs RelatedCandidate → identical top IDs. */
function expectLegacyVsSlimParity(
  current: RelatedScorableProduct,
  catalog: Array<{ full: Product; slim: RelatedCandidate }>,
  limit = 6,
) {
  const legacyIds = getRelatedProducts({
    currentProduct: current,
    allProducts: catalog.map((c) => c.full),
    limit,
  }).map((p) => p.id);

  const slimIds = getRelatedProducts({
    currentProduct: current,
    allProducts: catalog.map((c) => c.slim),
    limit,
  }).map((p) => p.id);

  expect(slimIds).toEqual(legacyIds);
  return slimIds;
}

describe("RELATED_CANDIDATE_SELECT projection", () => {
  it("selects DB-real score columns only", () => {
    for (const key of RELATED_CANDIDATE_COLUMN_KEYS) {
      expect(RELATED_CANDIDATE_SELECT.split(",")).toContain(key);
    }
    expect(RELATED_CANDIDATE_SELECT).not.toContain("is_popular");
    expect(RELATED_CANDIDATE_SELECT).not.toContain("is_recommend");
  });

  it("excludes heavy PDP / card fields from Stage-1", () => {
    for (const heavy of RELATED_CANDIDATE_EXCLUDED_COLUMNS) {
      expect(RELATED_CANDIDATE_SELECT.split(",")).not.toContain(heavy);
    }
    for (const heavy of PRODUCT_LISTING_EXCLUDED_HEAVY_COLUMNS) {
      expect(RELATED_CANDIDATE_SELECT.split(",")).not.toContain(heavy);
    }
  });

  it("Stage-2 uses PRODUCT_LISTING_SELECT", () => {
    expect(relatedStage2ListingSelect()).toBe(PRODUCT_LISTING_SELECT);
  });

  it("chunk size is 500 (full-universe correctness, no arbitrary cap)", () => {
    expect(RELATED_CANDIDATE_CHUNK_SIZE).toBe(500);
  });
});

describe("mapRowToRelatedCandidate", () => {
  it("maps safe fields without normalizeProduct", () => {
    const c = mapRowToRelatedCandidate({
      id: "p1",
      destination_id: "d1",
      product_line_id: "pl1",
      category: "일본",
      theme: "골프",
      created_at: "2026-01-01T00:00:00.000Z",
      campaigns_json: ["추천"],
    });
    expect(c.id).toBe("p1");
    expect(c.destination_id).toBe("d1");
    expect(c.is_popular).toBeUndefined();
    expect(c.is_recommend).toBeUndefined();
  });
});

describe("legacy-vs-slim exact top-6 parity", () => {
  const current = slimCandidate({
    id: "current",
    destination_id: "dest-1",
    product_line_id: "line-a",
    category: "일본",
    theme: "골프,휴양",
    created_at: "2025-01-01T00:00:00.000Z",
  });

  it("strong destination (+5) ranks above weaker matches", () => {
    const pairs = [
      {
        full: fullProduct({
          id: "dest-match",
          destination_id: "dest-1",
          category: "태국",
          theme: "쇼핑",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "dest-match",
          destination_id: "dest-1",
          category: "태국",
          theme: "쇼핑",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "cat-only",
          destination_id: "other",
          category: "일본",
          theme: "쇼핑",
          created_at: "2024-06-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "cat-only",
          destination_id: "other",
          category: "일본",
          theme: "쇼핑",
          created_at: "2024-06-01T00:00:00.000Z",
        }),
      },
    ];
    const ids = expectLegacyVsSlimParity(current, pairs, 6);
    expect(ids[0]).toBe("dest-match");
  });

  it("theme overlap (+3), category (+2), product_line (+2)", () => {
    const pairs = [
      {
        full: fullProduct({
          id: "theme",
          theme: "골프",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "theme",
          theme: "골프",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "cat",
          category: "일본",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "cat",
          category: "일본",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "line",
          product_line_id: "line-a",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "line",
          product_line_id: "line-a",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
      },
    ];
    expectLegacyVsSlimParity(current, pairs, 6);
    expect(scoreRelatedProduct(current, pairs[0]!.slim, REF)).toBe(3);
    expect(scoreRelatedProduct(current, pairs[1]!.slim, REF)).toBe(2);
    expect(scoreRelatedProduct(current, pairs[2]!.slim, REF)).toBe(2);
  });

  it("recency-only candidate scores 0.5 and qualifies", () => {
    const recent = slimCandidate({
      id: "recent-only",
      created_at: "2026-07-01T00:00:00.000Z",
    });
    expect(scoreRelatedProduct(current, recent, REF)).toBe(0.5);
    expect(scoreRelatedProduct(current, recent, REF)).toBeGreaterThanOrEqual(
      MIN_RELATED_SCORE,
    );

    const pairs = [
      {
        full: fullProduct({
          id: "recent-only",
          created_at: "2026-07-01T00:00:00.000Z",
        }),
        slim: recent,
      },
      {
        full: fullProduct({
          id: "old-zero",
          created_at: "2020-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "old-zero",
          created_at: "2020-01-01T00:00:00.000Z",
        }),
      },
    ];
    const ids = expectLegacyVsSlimParity(current, pairs, 6);
    expect(ids[0]).toBe("recent-only");
  });

  it("promotion-first even with lower score", () => {
    const pairs = [
      {
        full: fullProduct({
          id: "high",
          destination_id: "dest-1",
          category: "일본",
          theme: "골프",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "high",
          destination_id: "dest-1",
          category: "일본",
          theme: "골프",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "promo",
          destination_id: "other",
          category: "태국",
          theme: "휴양",
          created_at: "2024-01-01T00:00:00.000Z",
          campaign_card_meta: [promoMeta()],
        }),
        slim: slimCandidate({
          id: "promo",
          destination_id: "other",
          category: "태국",
          theme: "휴양",
          created_at: "2024-01-01T00:00:00.000Z",
          campaign_card_meta: [promoMeta()],
        }),
      },
    ];
    const ids = expectLegacyVsSlimParity(current, pairs, 6);
    expect(ids[0]).toBe("promo");
    expect(ids[1]).toBe("high");
  });

  it("qualifying < 6 fills with score0 fallback; current excluded", () => {
    const pairs = [
      {
        full: fullProduct({
          id: "current",
          destination_id: "dest-1",
          category: "일본",
          theme: "골프",
          created_at: "2025-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "current",
          destination_id: "dest-1",
          category: "일본",
          theme: "골프",
          created_at: "2025-01-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "m1",
          destination_id: "dest-1",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "m1",
          destination_id: "dest-1",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "m2",
          category: "일본",
          created_at: "2024-02-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "m2",
          category: "일본",
          created_at: "2024-02-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "m3",
          theme: "골프",
          created_at: "2024-03-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "m3",
          theme: "골프",
          created_at: "2024-03-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "z-newer",
          created_at: "2023-06-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "z-newer",
          created_at: "2023-06-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "z-older",
          created_at: "2022-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "z-older",
          created_at: "2022-01-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "z-mid",
          created_at: "2023-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "z-mid",
          created_at: "2023-01-01T00:00:00.000Z",
        }),
      },
    ];

    const ids = expectLegacyVsSlimParity(current, pairs, 6);
    expect(ids).toHaveLength(6);
    expect(ids).not.toContain("current");
    expect(scoreRelatedProduct(current, pairs.find((p) => p.slim.id === "z-newer")!.slim, REF)).toBe(
      0,
    );
    // score0 fallback uses same sort: created_at DESC among zeros
    const zeroTail = ids.filter((id) => id.startsWith("z-"));
    expect(zeroTail).toEqual(["z-newer", "z-mid", "z-older"]);
  });

  it("fallback does not use catalog sort_order — promotion then score then created_at", () => {
    const pairs = [
      {
        full: fullProduct({
          id: "score0-promo",
          created_at: "2020-01-01T00:00:00.000Z",
          campaign_card_meta: [promoMeta()],
        }),
        slim: slimCandidate({
          id: "score0-promo",
          created_at: "2020-01-01T00:00:00.000Z",
          campaign_card_meta: [promoMeta()],
        }),
      },
      {
        full: fullProduct({
          id: "score0-plain",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "score0-plain",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
      },
    ];
    // no matched (≥0.5) except none — both score 0 → fill both, promo first
    const ids = expectLegacyVsSlimParity(
      slimCandidate({ id: "cur", created_at: "2010-01-01T00:00:00.000Z" }),
      pairs,
      6,
    );
    expect(ids[0]).toBe("score0-promo");
    expect(ids[1]).toBe("score0-plain");
  });

  it("deterministic tie: no id tie-break — preserves existing unstable equal created_at behavior via parity", () => {
    const pairs = [
      {
        full: fullProduct({
          id: "a",
          category: "일본",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "a",
          category: "일본",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "b",
          category: "일본",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "b",
          category: "일본",
          created_at: "2024-01-01T00:00:00.000Z",
        }),
      },
    ];
    expectLegacyVsSlimParity(current, pairs, 6);
  });
});

describe("campaign hydration parity for RelatedCandidate", () => {
  it("hydrate before sort changes promotion ordering", () => {
    const taxonomies: ProductTaxonomy[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        name: "시즌특가",
        slug: "promotion",
        taxonomy_type: "campaign",
        is_active: true,
        sort_order: 1,
        created_at: null,
        is_hub_visible: false,
        is_landing_enabled: false,
        badge_visible: true,
        badge_priority: 1,
        badge_tone: "neutral",
        display_label: "시즌 / 특가",
      },
    ];

    const raw: RelatedCandidate[] = [
      slimCandidate({
        id: "high",
        destination_id: "dest-1",
        created_at: "2024-01-01T00:00:00.000Z",
      }),
      slimCandidate({
        id: "promo-token",
        destination_id: "other",
        created_at: "2024-01-01T00:00:00.000Z",
        campaigns_json: ["11111111-1111-4111-8111-111111111111"],
      }),
    ];

    const current = slimCandidate({ id: "current", destination_id: "dest-1" });
    const before = sortRelatedProducts(current, raw);
    expect(before[0]?.id).toBe("high");

    const after = sortRelatedProducts(
      current,
      hydrateProductsWithCampaignCardMeta(raw, taxonomies),
    );
    expect(after[0]?.id).toBe("promo-token");
    expect(after[0]?.campaign_card_meta?.[0]?.isPromotionCampaign).toBe(true);
  });
});

describe("restoreRelatedProductListItemOrderByIds", () => {
  it("restores score order and throws on missing id", () => {
    const items = [
      { id: "b" } as ProductListItem,
      { id: "a" } as ProductListItem,
    ];
    expect(restoreRelatedProductListItemOrderByIds(["a", "b"], items).map((p) => p.id)).toEqual([
      "a",
      "b",
    ]);
    expect(() => restoreRelatedProductListItemOrderByIds(["a", "c"], items)).toThrow(
      /missing products/,
    );
  });
});
