import { describe, expect, it } from "vitest";
import {
  PRODUCT_LIST_PAGE_SIZE,
  PRODUCT_LIST_PAGE_SIZE_MAX,
  applyProductListingSort,
  buildProductPageMeta,
  buildProductPageRange,
  normalizeProductPageInput,
  resolveProductListingSort,
} from "@/lib/products/productListingQuery";

describe("normalizeProductPageInput", () => {
  it("defaults page=1 and pageSize=24", () => {
    expect(normalizeProductPageInput({})).toEqual({
      page: 1,
      pageSize: PRODUCT_LIST_PAGE_SIZE,
    });
  });

  it("normalizes invalid page to 1", () => {
    expect(normalizeProductPageInput({ page: undefined }).page).toBe(1);
    expect(normalizeProductPageInput({ page: 0 }).page).toBe(1);
    expect(normalizeProductPageInput({ page: -5 }).page).toBe(1);
    expect(normalizeProductPageInput({ page: Number.NaN }).page).toBe(1);
    expect(normalizeProductPageInput({ page: Number.POSITIVE_INFINITY }).page).toBe(1);
  });

  it("floors valid page", () => {
    expect(normalizeProductPageInput({ page: 2.9 }).page).toBe(2);
  });

  it("pageSize undefined → 24; 0/negative → default; too large → max", () => {
    expect(normalizeProductPageInput({ pageSize: undefined }).pageSize).toBe(24);
    expect(normalizeProductPageInput({ pageSize: 0 }).pageSize).toBe(24);
    expect(normalizeProductPageInput({ pageSize: -1 }).pageSize).toBe(24);
    expect(normalizeProductPageInput({ pageSize: 101 }).pageSize).toBe(PRODUCT_LIST_PAGE_SIZE_MAX);
    expect(normalizeProductPageInput({ pageSize: 50 }).pageSize).toBe(50);
  });
});

describe("buildProductPageRange", () => {
  it("page 1 / size 24 → 0..23", () => {
    expect(buildProductPageRange(1, 24)).toEqual({ from: 0, to: 23 });
  });
  it("page 2 → 24..47", () => {
    expect(buildProductPageRange(2, 24)).toEqual({ from: 24, to: 47 });
  });
  it("page 3 → 48..71", () => {
    expect(buildProductPageRange(3, 24)).toEqual({ from: 48, to: 71 });
  });
});

describe("buildProductPageMeta", () => {
  it("0 results → totalPages=0, hasNext=false", () => {
    expect(buildProductPageMeta({ totalCount: 0, page: 1, pageSize: 24 })).toEqual({
      totalCount: 0,
      page: 1,
      pageSize: 24,
      totalPages: 0,
      hasNextPage: false,
    });
  });

  it("totalCount boundaries", () => {
    expect(buildProductPageMeta({ totalCount: 1, page: 1, pageSize: 24 }).totalPages).toBe(1);
    expect(buildProductPageMeta({ totalCount: 24, page: 1, pageSize: 24 }).totalPages).toBe(1);
    expect(buildProductPageMeta({ totalCount: 25, page: 1, pageSize: 24 })).toMatchObject({
      totalPages: 2,
      hasNextPage: true,
    });
    expect(buildProductPageMeta({ totalCount: 25, page: 2, pageSize: 24 })).toMatchObject({
      totalPages: 2,
      hasNextPage: false,
    });
  });

  it("out-of-range page keeps page number; hasNext=false", () => {
    expect(buildProductPageMeta({ totalCount: 30, page: 99, pageSize: 24 })).toEqual({
      totalCount: 30,
      page: 99,
      pageSize: 24,
      totalPages: 2,
      hasNextPage: false,
    });
  });
});

describe("resolveProductListingSort", () => {
  it("maps known sorts; unknown → recommended", () => {
    expect(resolveProductListingSort("latest")).toBe("latest");
    expect(resolveProductListingSort("price_asc")).toBe("price_asc");
    expect(resolveProductListingSort("price_desc")).toBe("price_desc");
    expect(resolveProductListingSort("recommended")).toBe("recommended");
    expect(resolveProductListingSort(null)).toBe("recommended");
    expect(resolveProductListingSort(undefined)).toBe("recommended");
  });
});

describe("applyProductListingSort", () => {
  it("always ends with id ASC tie-breaker", () => {
    const calls: { column: string; ascending?: boolean }[] = [];
    const stub = {
      order(column: string, options?: { ascending?: boolean }) {
        calls.push({ column, ascending: options?.ascending });
        return stub;
      },
    };

    for (const sort of ["recommended", "latest", "price_asc", "price_desc"] as const) {
      calls.length = 0;
      applyProductListingSort(stub, sort);
      expect(calls.at(-1)).toEqual({ column: "id", ascending: true });
    }
  });

  it("recommended uses sort_order then created_at then id", () => {
    const cols: string[] = [];
    const stub = {
      order(column: string) {
        cols.push(column);
        return stub;
      },
    };
    applyProductListingSort(stub, "recommended");
    expect(cols).toEqual(["sort_order", "created_at", "id"]);
  });
});
