import "server-only";

import { ContextValidationError } from "@/lib/marketing/context/errors";
import type { ProductContext } from "@/lib/marketing/context/types";
import { isUuid, requireUuid } from "@/lib/marketing/context/validation";
import {
  PRODUCT_MEMORY_DEFAULT_LIMIT,
  PRODUCT_MEMORY_MAX_LIMIT,
  PRODUCT_MEMORY_SOURCE_NAME,
} from "@/lib/marketing/memory/constants";
import { MemoryValidationError } from "@/lib/marketing/memory/errors";
import { mapProductContextToMemoryDocument } from "@/lib/marketing/memory/productMemoryContent";
import type { MemoryDocument, MemoryIngestionSource } from "@/lib/marketing/memory/types";

export type ProductMemoryLoadParams = {
  productId?: string;
  productIds?: string[];
  activeOnly?: boolean;
  limit?: number;
  /** Not supported: products.updated_at is not a guaranteed column. */
  updatedAfter?: string;
};

export type ParsedProductMemoryLoadParams = {
  ids: string[];
  activeOnly: boolean;
  limit: number;
};

export type ProductMemorySourceDeps = {
  loadProducts?: (params: ParsedProductMemoryLoadParams) => Promise<ProductContext[]>;
};

export function parseProductMemoryLoadParams(params: ProductMemoryLoadParams = {}): ParsedProductMemoryLoadParams {
  if (params.updatedAfter != null && params.updatedAfter.trim() !== "") {
    throw new MemoryValidationError("updatedAfter is not supported because products.updated_at is not guaranteed");
  }
  const limit = params.limit ?? PRODUCT_MEMORY_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > PRODUCT_MEMORY_MAX_LIMIT) {
    throw new MemoryValidationError(`limit must be an integer between 1 and ${PRODUCT_MEMORY_MAX_LIMIT}`);
  }
  const ids: string[] = [];
  const seen = new Set<string>();
  const pushId = (value: string, field: string) => {
    const id = requireUuid(value, field);
    if (seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  if (params.productId) pushId(params.productId, "productId");
  for (const value of params.productIds ?? []) {
    if (typeof value !== "string" || !isUuid(value)) {
      throw new ContextValidationError("productIds must be UUIDs");
    }
    pushId(value, "productIds");
  }
  if (ids.length > PRODUCT_MEMORY_MAX_LIMIT) {
    throw new MemoryValidationError(`productIds exceed PRODUCT_MEMORY_MAX_LIMIT (${PRODUCT_MEMORY_MAX_LIMIT})`);
  }
  return {
    ids,
    activeOnly: params.activeOnly === true,
    limit,
  };
}

export class ProductMemorySource implements MemoryIngestionSource<ProductMemoryLoadParams> {
  readonly name = PRODUCT_MEMORY_SOURCE_NAME;

  constructor(private readonly deps: ProductMemorySourceDeps = {}) {}

  async load(params: ProductMemoryLoadParams = {}): Promise<MemoryDocument[]> {
    const parsed = parseProductMemoryLoadParams(params);
    const products = await this.loadProducts(parsed);
    return products.map(mapProductContextToMemoryDocument);
  }

  private async loadProducts(parsed: ParsedProductMemoryLoadParams): Promise<ProductContext[]> {
    if (this.deps.loadProducts) return this.deps.loadProducts(parsed);
    const { loadProductContexts } = await import("@/lib/marketing/context/loadProductContext");
    return loadProductContexts({
      ids: parsed.ids.length > 0 ? parsed.ids.slice(0, parsed.limit) : undefined,
      activeOnly: parsed.activeOnly,
      limit: parsed.limit,
    });
  }
}

export function createProductMemorySource(deps: ProductMemorySourceDeps = {}): ProductMemorySource {
  return new ProductMemorySource(deps);
}
