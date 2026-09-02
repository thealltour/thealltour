/**
 * POST-UI-01D-3B: Guide bridge full-slim candidate parity + projection tests.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { Product } from "@/types/product";
import {
  GUIDE_BRIDGE_SCORE_WEIGHTS,
  computeGuideBridgeRecommendations,
  scoreProductForGuideBridge,
  type GuideBridgeRecContext,
  type GuideScorableProduct,
} from "@/lib/products/guideBridgeScoring";
import {
  GUIDE_BRIDGE_CANDIDATE_CHUNK_SIZE,
  GUIDE_BRIDGE_CANDIDATE_COLUMN_KEYS,
  GUIDE_BRIDGE_CANDIDATE_EXCLUDED_COLUMNS,
  GUIDE_BRIDGE_CANDIDATE_SELECT,
  guideBridgeStage2ListingSelect,
  mapRowToGuideBridgeCandidate,
  restoreGuideBridgeProductListItemOrderByIds,
  type GuideBridgeCandidate,
} from "@/lib/products/guideBridgeCandidate";
import {
  PRODUCT_LISTING_EXCLUDED_HEAVY_COLUMNS,
  PRODUCT_LISTING_SELECT,
  type ProductListItem,
} from "@/lib/products/productListItem";

function slimCandidate(
  overrides: Partial<GuideBridgeCandidate> & { id: string; title?: string },
): GuideBridgeCandidate {
  return mapRowToGuideBridgeCandidate({
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    destination_id: overrides.destination_id ?? null,
    category: overrides.category ?? null,
    theme: overrides.theme ?? null,
    description: overrides.description ?? null,
    sort_order: overrides.sort_order ?? null,
    created_at: overrides.created_at ?? null,
  });
}

/** Legacy full Product carries score fields + heavy blobs score ignores. */
function fullProduct(
  overrides: Partial<Product> & { id: string; title?: string },
): Product {
  const slim = slimCandidate({
    id: overrides.id,
    title: overrides.title,
    destination_id: overrides.destination_id,
    category: overrides.category,
    theme: overrides.theme,
    description: overrides.description,
    sort_order: overrides.sort_order,
    created_at: overrides.created_at,
  });
  return {
    ...slim,
    price: overrides.price ?? 999_999,
    image_url: overrides.image_url ?? "/heavy.jpg",
    images_json: overrides.images_json ?? ["blob"],
    itinerary: overrides.itinerary ?? [{ day: 1 }],
    campaigns_json: overrides.campaigns_json ?? ["campaign-id"],
  } as Product;
}

function baseCtx(overrides?: Partial<GuideBridgeRecContext>): GuideBridgeRecContext {
  return {
    guideDestinationId: null,
    guideThemeId: null,
    themeNameLower: null,
    destinationNameLower: null,
    searchTokens: [],
    ...overrides,
  };
}

function expectLegacyVsSlimParity(
  ctx: GuideBridgeRecContext,
  catalog: Array<{ full: Product; slim: GuideBridgeCandidate }>,
  options?: { totalLimit?: number },
) {
  const legacy = computeGuideBridgeRecommendations(
    catalog.map((c) => c.full as GuideScorableProduct),
    ctx,
    options,
  );
  const slim = computeGuideBridgeRecommendations(
    catalog.map((c) => c.slim),
    ctx,
    options,
  );

  expect(slim.all.map((p) => p.id)).toEqual(legacy.all.map((p) => p.id));
  expect(slim.primary.map((p) => p.id)).toEqual(legacy.primary.map((p) => p.id));
  expect(slim.secondary.map((p) => p.id)).toEqual(legacy.secondary.map((p) => p.id));
  expect(slim.fallback.map((p) => p.id)).toEqual(legacy.fallback.map((p) => p.id));
  return slim;
}

describe("GUIDE_BRIDGE_CANDIDATE_SELECT projection", () => {
  it("selects DB-real score columns only", () => {
    const cols = GUIDE_BRIDGE_CANDIDATE_SELECT.split(",");
    for (const key of GUIDE_BRIDGE_CANDIDATE_COLUMN_KEYS) {
      expect(cols).toContain(key);
    }
    expect(cols).toHaveLength(GUIDE_BRIDGE_CANDIDATE_COLUMN_KEYS.length);
  });

  it("includes description for token scoring", () => {
    expect(GUIDE_BRIDGE_CANDIDATE_SELECT.split(",")).toContain("description");
  });

  it("excludes heavy PDP / card fields from Stage-1", () => {
    for (const heavy of GUIDE_BRIDGE_CANDIDATE_EXCLUDED_COLUMNS) {
      expect(GUIDE_BRIDGE_CANDIDATE_SELECT.split(",")).not.toContain(heavy);
    }
    for (const heavy of PRODUCT_LISTING_EXCLUDED_HEAVY_COLUMNS) {
      if (heavy === "description") continue;
      expect(GUIDE_BRIDGE_CANDIDATE_SELECT.split(",")).not.toContain(heavy);
    }
    expect(GUIDE_BRIDGE_CANDIDATE_SELECT.split(",")).not.toContain("campaigns_json");
    expect(GUIDE_BRIDGE_CANDIDATE_SELECT.split(",")).not.toContain("price");
    expect(GUIDE_BRIDGE_CANDIDATE_SELECT.split(",")).not.toContain("images_json");
  });

  it("Stage-2 uses PRODUCT_LISTING_SELECT", () => {
    expect(guideBridgeStage2ListingSelect()).toBe(PRODUCT_LISTING_SELECT);
  });

  it("chunk size is 500 (full-universe correctness, no arbitrary cap)", () => {
    expect(GUIDE_BRIDGE_CANDIDATE_CHUNK_SIZE).toBe(500);
  });
});

describe("mapRowToGuideBridgeCandidate", () => {
  it("maps safe fields without normalizeProduct", () => {
    const c = mapRowToGuideBridgeCandidate({
      id: "p1",
      title: "Tokyo Tour",
      destination_id: "d1",
      category: "일본",
      theme: "골프",
      description: "desc only in slim",
      sort_order: 2,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    expect(c.id).toBe("p1");
    expect(c.description).toBe("desc only in slim");
  });
});

describe("score weights", () => {
  const ctx = baseCtx();

  it("destination exact +100", () => {
    const p = slimCandidate({ id: "p1", destination_id: "dest-1" });
    const scored = scoreProductForGuideBridge(
      p,
      baseCtx({ guideDestinationId: "dest-1" }),
    );
    expect(scored.score).toBe(GUIDE_BRIDGE_SCORE_WEIGHTS.destinationExact);
    expect(scored.reasons).toContain("destination:exact");
  });

  it("theme exact token +60", () => {
    const p = slimCandidate({ id: "p1", theme: "골프,휴양" });
    const scored = scoreProductForGuideBridge(
      p,
      baseCtx({ themeNameLower: "골프" }),
    );
    expect(scored.score).toBe(GUIDE_BRIDGE_SCORE_WEIGHTS.themeTokenExact);
  });

  it("theme partial token +35", () => {
    const p = slimCandidate({ id: "p1", theme: "골프투어" });
    const scored = scoreProductForGuideBridge(
      p,
      baseCtx({ themeNameLower: "골프" }),
    );
    expect(scored.score).toBe(GUIDE_BRIDGE_SCORE_WEIGHTS.themeTokenPartial);
  });

  it("title search token +25", () => {
    const p = slimCandidate({ id: "p1", title: "오사카 벚꽃 여행" });
    const scored = scoreProductForGuideBridge(
      p,
      baseCtx({ searchTokens: ["벚꽃"] }),
    );
    expect(scored.score).toBeGreaterThanOrEqual(GUIDE_BRIDGE_SCORE_WEIGHTS.tokenTitle);
    expect(scored.reasons.some((r) => r.startsWith("token:title="))).toBe(true);
  });

  it("category search token +18", () => {
    const p = slimCandidate({ id: "p1", category: "일본여행" });
    const scored = scoreProductForGuideBridge(
      p,
      baseCtx({ searchTokens: ["일본"] }),
    );
    expect(scored.score).toBeGreaterThanOrEqual(GUIDE_BRIDGE_SCORE_WEIGHTS.tokenCategory);
  });

  it("theme search token +20", () => {
    const p = slimCandidate({ id: "p1", theme: "온천,힐링" });
    const scored = scoreProductForGuideBridge(
      p,
      baseCtx({ searchTokens: ["온천"] }),
    );
    expect(scored.score).toBeGreaterThanOrEqual(GUIDE_BRIDGE_SCORE_WEIGHTS.tokenTheme);
  });

  it("description search token +8", () => {
    const p = slimCandidate({ id: "p1", description: "교토 사찰 투어 코스" });
    const scored = scoreProductForGuideBridge(
      p,
      baseCtx({ searchTokens: ["교토"] }),
    );
    expect(scored.score).toBe(GUIDE_BRIDGE_SCORE_WEIGHTS.tokenDescription);
    expect(scored.reasons.some((r) => r.startsWith("token:description="))).toBe(true);
  });

  it("unique token bonus 2/3/4", () => {
    const p = slimCandidate({
      id: "p1",
      title: "alpha beta",
      category: "gamma",
      theme: "delta",
      description: "epsilon",
    });
    const s2 = scoreProductForGuideBridge(
      p,
      baseCtx({ searchTokens: ["alpha", "beta"] }),
    );
    expect(s2.score).toBe(
      GUIDE_BRIDGE_SCORE_WEIGHTS.tokenTitle * 2 + GUIDE_BRIDGE_SCORE_WEIGHTS.bonusTokens2,
    );

    const s3 = scoreProductForGuideBridge(
      p,
      baseCtx({ searchTokens: ["alpha", "beta", "gamma"] }),
    );
    expect(s3.score).toBe(
      GUIDE_BRIDGE_SCORE_WEIGHTS.tokenTitle * 2 +
        GUIDE_BRIDGE_SCORE_WEIGHTS.tokenCategory +
        GUIDE_BRIDGE_SCORE_WEIGHTS.bonusTokens3,
    );

    const s4 = scoreProductForGuideBridge(
      p,
      baseCtx({ searchTokens: ["alpha", "beta", "gamma", "delta"] }),
    );
    expect(s4.score).toBe(
      GUIDE_BRIDGE_SCORE_WEIGHTS.tokenTitle * 2 +
        GUIDE_BRIDGE_SCORE_WEIGHTS.tokenCategory +
        GUIDE_BRIDGE_SCORE_WEIGHTS.tokenTheme +
        GUIDE_BRIDGE_SCORE_WEIGHTS.bonusTokens4,
    );
  });
});

describe("legacy-vs-slim exact ID parity", () => {
  it("destination match ranks first", () => {
    const ctx = baseCtx({ guideDestinationId: "dest-1" });
    const pairs = [
      {
        full: fullProduct({ id: "dest-match", destination_id: "dest-1", sort_order: 5 }),
        slim: slimCandidate({ id: "dest-match", destination_id: "dest-1", sort_order: 5 }),
      },
      {
        full: fullProduct({ id: "other", destination_id: "x", sort_order: 1 }),
        slim: slimCandidate({ id: "other", destination_id: "x", sort_order: 1 }),
      },
    ];
    const result = expectLegacyVsSlimParity(ctx, pairs, { totalLimit: 12 });
    expect(result.all[0]?.id).toBe("dest-match");
  });

  it("soft diversity prefers alternate destination when top-3 same dest", () => {
    const ctx = baseCtx({
      guideDestinationId: "dest-1",
      themeNameLower: "골프",
      searchTokens: ["특가"],
    });
    const pairs = [
      {
        full: fullProduct({ id: "a", destination_id: "dest-1", sort_order: 1 }),
        slim: slimCandidate({ id: "a", destination_id: "dest-1", sort_order: 1 }),
      },
      {
        full: fullProduct({ id: "b", destination_id: "dest-1", sort_order: 2 }),
        slim: slimCandidate({ id: "b", destination_id: "dest-1", sort_order: 2 }),
      },
      {
        full: fullProduct({ id: "c", destination_id: "dest-1", sort_order: 3 }),
        slim: slimCandidate({ id: "c", destination_id: "dest-1", sort_order: 3 }),
      },
      {
        full: fullProduct({
          id: "alt",
          destination_id: "dest-2",
          theme: "골프",
          title: "특가 골프",
          sort_order: 4,
        }),
        slim: slimCandidate({
          id: "alt",
          destination_id: "dest-2",
          theme: "골프",
          title: "특가 골프",
          sort_order: 4,
        }),
      },
    ];
    const result = expectLegacyVsSlimParity(ctx, pairs, { totalLimit: 12 });
    expect(result.primary.map((p) => p.id)).toContain("alt");
  });

  it("score0 fallback fills from catalog order sort_order ASC then created_at DESC", () => {
    const ctx = baseCtx();
    const pairs = [
      {
        full: fullProduct({
          id: "z-newer",
          sort_order: 10,
          created_at: "2024-06-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "z-newer",
          sort_order: 10,
          created_at: "2024-06-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "z-older",
          sort_order: 10,
          created_at: "2023-06-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "z-older",
          sort_order: 10,
          created_at: "2023-06-01T00:00:00.000Z",
        }),
      },
      {
        full: fullProduct({
          id: "z-first-sort",
          sort_order: 1,
          created_at: "2020-01-01T00:00:00.000Z",
        }),
        slim: slimCandidate({
          id: "z-first-sort",
          sort_order: 1,
          created_at: "2020-01-01T00:00:00.000Z",
        }),
      },
    ];
    const result = expectLegacyVsSlimParity(ctx, pairs, { totalLimit: 12 });
    expect(result.all.map((p) => p.id)).toEqual([
      "z-first-sort",
      "z-newer",
      "z-older",
    ]);
    expect(result.fallback.map((p) => p.id)).toEqual([
      "z-first-sort",
      "z-newer",
      "z-older",
    ]);
  });

  it("totalLimit 12 caps all array", () => {
    const ctx = baseCtx({ guideDestinationId: "dest-1" });
    const pairs = Array.from({ length: 20 }, (_, i) => {
      const id = `p${i}`;
      return {
        full: fullProduct({ id, destination_id: "dest-1", sort_order: i }),
        slim: slimCandidate({ id, destination_id: "dest-1", sort_order: i }),
      };
    });
    const result = expectLegacyVsSlimParity(ctx, pairs, { totalLimit: 12 });
    expect(result.all.length).toBeLessThanOrEqual(12);
  });

  it("default totalLimit 18 contract", () => {
    const ctx = baseCtx({ guideDestinationId: "dest-1" });
    const pairs = Array.from({ length: 25 }, (_, i) => {
      const id = `p${i}`;
      return {
        full: fullProduct({ id, destination_id: "dest-1", sort_order: i }),
        slim: slimCandidate({ id, destination_id: "dest-1", sort_order: i }),
      };
    });
    const result = computeGuideBridgeRecommendations(
      pairs.map((p) => p.slim),
      ctx,
    );
    expect(result.all.length).toBeLessThanOrEqual(18);
  });

  it("primary ≤3 and secondary ≤6 split", () => {
    const ctx = baseCtx({ guideDestinationId: "dest-1" });
    const pairs = Array.from({ length: 15 }, (_, i) => {
      const id = `p${i}`;
      return {
        full: fullProduct({ id, destination_id: "dest-1", sort_order: i }),
        slim: slimCandidate({ id, destination_id: "dest-1", sort_order: i }),
      };
    });
    const result = expectLegacyVsSlimParity(ctx, pairs, { totalLimit: 12 });
    expect(result.primary.length).toBeLessThanOrEqual(3);
    expect(result.secondary.length).toBeLessThanOrEqual(6);
  });
});

describe("chunking loop semantics", () => {
  it("501 rows across two 500-sized pages stops after short page", () => {
    const chunkSize = GUIDE_BRIDGE_CANDIDATE_CHUNK_SIZE;
    const totalRows = 501;
    const pages: number[] = [];
    let from = 0;
    for (;;) {
      const pageLen = Math.min(chunkSize, totalRows - from);
      pages.push(pageLen);
      from += chunkSize;
      if (pageLen < chunkSize) break;
    }
    expect(pages).toEqual([500, 1]);
  });
});

describe("restoreGuideBridgeProductListItemOrderByIds", () => {
  it("restores selectedIds order and throws on missing id", () => {
    const items = [{ id: "b" } as ProductListItem, { id: "a" } as ProductListItem];
    expect(restoreGuideBridgeProductListItemOrderByIds(["a", "b"], items).map((p) => p.id)).toEqual(
      ["a", "b"],
    );
    expect(() => restoreGuideBridgeProductListItemOrderByIds(["a", "c"], items)).toThrow(
      /missing products/,
    );
  });
});

describe("Guide page source contract", () => {
  const GUIDE_PAGE = readFileSync(
    resolve(process.cwd(), "src/app/guides/[slug]/page.tsx"),
    "utf8",
  );
  const CANDIDATE_SOURCE = readFileSync(
    resolve(process.cwd(), "src/lib/products/guideBridgeCandidate.ts"),
    "utf8",
  );

  it("guide page does not call getProducts", () => {
    expect(GUIDE_PAGE).not.toMatch(/await getProducts\(/);
    expect(GUIDE_PAGE).not.toMatch(/import\s*\{[^}]*\bgetProducts\b/);
  });

  it("candidate fetch uses slim select without select(*) or normalizeProduct", () => {
    expect(CANDIDATE_SOURCE).toContain("GUIDE_BRIDGE_CANDIDATE_SELECT");
    expect(CANDIDATE_SOURCE).not.toMatch(/\.select\(\s*["']\*["']\s*\)/);
    expect(CANDIDATE_SOURCE).not.toMatch(/\bnormalizeProduct\s*\(/);
    expect(CANDIDATE_SOURCE).toContain(".range(");
    expect(CANDIDATE_SOURCE).toContain('order("id"');
  });
});

describe("repository getProducts() callers removed", () => {
  const SRC_ROOT = resolve(process.cwd(), "src");

  function walk(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === "__tests__") continue;
        out.push(...walk(full));
      } else if (/\.(ts|tsx)$/.test(entry.name)) {
        out.push(full.replace(/\\/g, "/"));
      }
    }
    return out;
  }

  function hasGetProductsCall(filePath: string): boolean {
    const text = readFileSync(filePath, "utf8");
    return text
      .split("\n")
      .filter((line) => {
        const t = line.trim();
        return !t.startsWith("*") && !t.startsWith("//");
      })
      .some((line) => /\bgetProducts\s*\(/.test(line));
  }

  it("repository total getProducts( callers = 0", () => {
    const rel = (p: string) => p.replace(/\\/g, "/").replace(/.*\/src\//, "src/");
    const callers = walk(SRC_ROOT).filter(hasGetProductsCall).map(rel);
    expect(callers).toEqual([]);
  });
});
