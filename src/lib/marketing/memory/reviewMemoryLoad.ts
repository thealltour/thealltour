import "server-only";

import { loadProductContexts } from "@/lib/marketing/context/loadProductContext";
import {
  fetchProductReviewSummaryRows,
  fetchSubmittedReviewRowsByProductIds,
} from "@/lib/marketing/context/sources/reviewSource";
import type { ProductReviewSummaryRow } from "@/lib/marketing/context/mappers/reviewInsightMapper";
import {
  REVIEW_MEMORY_MAX_BOOKINGS,
  REVIEW_MEMORY_MAX_RAW_REVIEWS,
  REVIEW_MEMORY_MAX_REVIEWS_PER_PRODUCT,
} from "@/lib/marketing/memory/constants";
import type {
  ParsedReviewMemoryLoadParams,
  ReviewMemoryBundle,
} from "@/lib/marketing/memory/sources/reviewMemorySource";

function asProductId(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export async function loadReviewMemoryBundles(
  params: ParsedReviewMemoryLoadParams,
): Promise<ReviewMemoryBundle[]> {
  const ids = params.ids.slice(0, params.limit);
  if (ids.length === 0) return [];

  const [summaries, reviewsByProduct, products] = await Promise.all([
    fetchProductReviewSummaryRows(ids),
    fetchSubmittedReviewRowsByProductIds({
      productIds: ids,
      periodStart: params.period?.start,
      periodEnd: params.period?.end,
      maxReviews: REVIEW_MEMORY_MAX_RAW_REVIEWS,
      maxBookings: REVIEW_MEMORY_MAX_BOOKINGS,
    }),
    loadProductContexts({ ids, limit: ids.length }),
  ]);

  const summaryByProduct = new Map<string, ProductReviewSummaryRow>();
  for (const summary of summaries) {
    const productId = asProductId(summary.product_id);
    if (productId) summaryByProduct.set(productId, summary);
  }
  const titleByProduct = new Map(products.map((product) => [product.id, product.title]));

  return ids.map((productId) => ({
    productId,
    productTitle: titleByProduct.get(productId) ?? null,
    summary: summaryByProduct.get(productId) ?? null,
    reviews: (reviewsByProduct.get(productId) ?? []).slice(0, REVIEW_MEMORY_MAX_REVIEWS_PER_PRODUCT),
  }));
}
