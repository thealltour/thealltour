import { emptyReviewInsight, mapReviewInsight } from "@/lib/marketing/context/mappers/reviewInsightMapper";
import {
  fetchProductReviewSummaryRow,
  fetchReviewRowsForProduct,
} from "@/lib/marketing/context/sources/reviewSource";
import { createRetrievalResult } from "@/lib/marketing/retrieval/result";
import { requireRetrievalPeriod } from "@/lib/marketing/retrieval/validation";
import type { ReviewInsightContext } from "@/lib/marketing/context/types";
import type { ParsedMarketingRetrievalRequest, RetrievalResult } from "@/lib/marketing/retrieval/types";

export async function retrieveReviews(
  request: ParsedMarketingRetrievalRequest,
): Promise<RetrievalResult<ReviewInsightContext>> {
  const period = requireRetrievalPeriod(request);
  const retrievedAt = new Date().toISOString();
  if (!request.productId) {
    return createRetrievalResult({
      data: emptyReviewInsight(),
      sourceType: "review_insight",
      sourceTable: "reviews",
      periodStart: period.start,
      periodEnd: period.end,
      retrievedAt,
    });
  }

  const [summary, reviews] = await Promise.all([
    fetchProductReviewSummaryRow(request.productId),
    fetchReviewRowsForProduct({
      productId: request.productId,
      periodStart: period.start,
      periodEnd: period.end,
      limit: request.limit,
    }),
  ]);

  return createRetrievalResult({
    data: mapReviewInsight({ summary, reviews }),
    sourceType: "review_insight",
    sourceTable: "reviews",
    sourceId: request.productId,
    periodStart: period.start,
    periodEnd: period.end,
    extraSources: [
      {
        sourceType: "review_insight",
        sourceId: request.productId,
        sourceTable: "product_review_summaries",
        retrievedAt,
        periodStart: period.start,
        periodEnd: period.end,
      },
    ],
    retrievedAt,
  });
}
