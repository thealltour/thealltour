import { asInteger, asNumber, asString, asStringArray } from "@/lib/marketing/context/json";
import type { ReviewInsightContext } from "@/lib/marketing/context/types";

export type ProductReviewSummaryRow = {
  product_id?: unknown;
  review_count?: unknown;
  average_rating?: unknown;
  summary_text?: unknown;
  positive_points?: unknown;
  negative_points?: unknown;
  recommended_for?: unknown;
  status?: unknown;
};

export type ReviewJoinRow = {
  booking_id?: unknown;
  content_good?: unknown;
  content_bad?: unknown;
  content_tip?: unknown;
  rating?: unknown;
  rating_schedule?: unknown;
  rating_stay?: unknown;
  rating_guide?: unknown;
  rating_food?: unknown;
};

export function mapReviewInsight(input: {
  summary: ProductReviewSummaryRow | null;
  reviews: ReviewJoinRow[];
}): ReviewInsightContext {
  const reviewCountFromRows = input.reviews.length;
  const summaryCount = asInteger(input.summary?.review_count);
  const ratings = input.reviews.map((row) => asNumber(row.rating)).filter((n): n is number => n != null);
  const averageFromRows = ratings.length > 0 ? average(ratings) : null;

  return {
    reviewCount: summaryCount ?? reviewCountFromRows,
    averageRating: asNumber(input.summary?.average_rating) ?? averageFromRows,
    summaryText: asString(input.summary?.summary_text),
    positivePoints: uniqueStrings([
      ...asStringArray(input.summary?.positive_points),
      ...input.reviews.map((row) => asString(row.content_good)).filter((s): s is string => Boolean(s)),
    ]),
    negativePoints: uniqueStrings([
      ...asStringArray(input.summary?.negative_points),
      ...input.reviews.map((row) => asString(row.content_bad)).filter((s): s is string => Boolean(s)),
    ]),
    contentTips: uniqueStrings(
      input.reviews.map((row) => asString(row.content_tip)).filter((s): s is string => Boolean(s)),
    ),
    scheduleRating: average(input.reviews.map((row) => asNumber(row.rating_schedule))),
    stayRating: average(input.reviews.map((row) => asNumber(row.rating_stay))),
    guideRating: average(input.reviews.map((row) => asNumber(row.rating_guide))),
    foodRating: average(input.reviews.map((row) => asNumber(row.rating_food))),
    recommendedFor: asStringArray(input.summary?.recommended_for),
  };
}

export function emptyReviewInsight(): ReviewInsightContext {
  return {
    reviewCount: 0,
    averageRating: null,
    summaryText: null,
    positivePoints: [],
    negativePoints: [],
    contentTips: [],
    scheduleRating: null,
    stayRating: null,
    guideRating: null,
    foodRating: null,
    recommendedFor: [],
  };
}

function average(values: Array<number | null>): number | null {
  const nums = values.filter((n): n is number => n != null);
  if (nums.length === 0) return null;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
