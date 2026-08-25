import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  ProductReviewSummaryRow,
  ReviewJoinRow,
} from "@/lib/marketing/context/mappers/reviewInsightMapper";

const SUMMARY_SELECT =
  "product_id, review_count, average_rating, summary_text, positive_points, negative_points, recommended_for, status";
const REVIEW_SELECT =
  "booking_id, content_good, content_bad, content_tip, rating, rating_schedule, rating_stay, rating_guide, rating_food";

/** Schema check: reviews.status in ('draft', 'submitted', 'hidden'). submitted = public/visible. */
const SUBMITTED_REVIEW_STATUS = "submitted";
const DEFAULT_MAX_BOOKINGS = 800;
const DEFAULT_MAX_REVIEWS = 400;

export async function fetchProductReviewSummaryRows(
  productIds: string[],
): Promise<ProductReviewSummaryRow[]> {
  if (productIds.length === 0) return [];
  const { data, error } = await supabaseAdmin
    .from("product_review_summaries")
    .select(SUMMARY_SELECT)
    .in("product_id", productIds);

  if (error) {
    throw new Error(`product_review_summaries lookup failed: ${error.message}`);
  }
  return (data as ProductReviewSummaryRow[] | null) ?? [];
}

export async function fetchProductReviewSummaryRow(
  productId: string,
): Promise<ProductReviewSummaryRow | null> {
  const rows = await fetchProductReviewSummaryRows([productId]);
  return rows[0] ?? null;
}

export async function fetchReviewRowsForProduct(input: {
  productId: string;
  periodStart: string;
  periodEnd: string;
  limit?: number;
}): Promise<ReviewJoinRow[]> {
  const { data: bookings, error: bookingError } = await supabaseAdmin
    .from("travel_bookings")
    .select("id")
    .eq("product_id", input.productId)
    .limit(input.limit ?? 200);

  if (bookingError) {
    throw new Error(`travel_bookings lookup for reviews failed: ${bookingError.message}`);
  }

  const bookingIds = (bookings ?? [])
    .map((row) => (typeof row.id === "string" ? row.id : null))
    .filter((id): id is string => Boolean(id));

  if (bookingIds.length === 0) return [];

  const { data, error } = await supabaseAdmin
    .from("reviews")
    .select("content_good, content_bad, content_tip, rating, rating_schedule, rating_stay, rating_guide, rating_food")
    .in("booking_id", bookingIds)
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 200);

  if (error) {
    throw new Error(`reviews lookup failed: ${error.message}`);
  }
  return (data as ReviewJoinRow[] | null) ?? [];
}

export type ReviewRowsByProductId = Map<string, ReviewJoinRow[]>;

/**
 * Batch reviews for many products: one travel_bookings query + one reviews query.
 * Uses reviews.booking_id → travel_bookings.product_id. Filters submitted only
 * (schema: draft | submitted | hidden; submitted is the public/visible value).
 */
export async function fetchSubmittedReviewRowsByProductIds(input: {
  productIds: string[];
  periodStart?: string;
  periodEnd?: string;
  maxReviews?: number;
  maxBookings?: number;
}): Promise<ReviewRowsByProductId> {
  const grouped: ReviewRowsByProductId = new Map();
  if (input.productIds.length === 0) return grouped;

  const { data: bookings, error: bookingError } = await supabaseAdmin
    .from("travel_bookings")
    .select("id, product_id")
    .in("product_id", input.productIds)
    .limit(input.maxBookings ?? DEFAULT_MAX_BOOKINGS);

  if (bookingError) {
    throw new Error(`travel_bookings lookup for reviews failed: ${bookingError.message}`);
  }

  const bookingToProduct = new Map<string, string>();
  for (const row of bookings ?? []) {
    const bookingId = typeof row.id === "string" ? row.id : null;
    const productId = typeof row.product_id === "string" ? row.product_id : null;
    if (!bookingId || !productId) continue;
    bookingToProduct.set(bookingId, productId);
  }

  const bookingIds = [...bookingToProduct.keys()];
  if (bookingIds.length === 0) return grouped;

  let query = supabaseAdmin
    .from("reviews")
    .select(REVIEW_SELECT)
    .in("booking_id", bookingIds)
    .eq("status", SUBMITTED_REVIEW_STATUS);
  if (input.periodStart) query = query.gte("created_at", input.periodStart);
  if (input.periodEnd) query = query.lte("created_at", input.periodEnd);

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(input.maxReviews ?? DEFAULT_MAX_REVIEWS);

  if (error) {
    throw new Error(`reviews lookup failed: ${error.message}`);
  }

  for (const row of (data as ReviewJoinRow[] | null) ?? []) {
    const bookingId = typeof row.booking_id === "string" ? row.booking_id : null;
    const productId = bookingId ? bookingToProduct.get(bookingId) : undefined;
    if (!productId) continue;
    const list = grouped.get(productId) ?? [];
    list.push(row);
    grouped.set(productId, list);
  }
  return grouped;
}
