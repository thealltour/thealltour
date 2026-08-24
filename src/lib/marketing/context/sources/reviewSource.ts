import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  ProductReviewSummaryRow,
  ReviewJoinRow,
} from "@/lib/marketing/context/mappers/reviewInsightMapper";

export async function fetchProductReviewSummaryRow(
  productId: string,
): Promise<ProductReviewSummaryRow | null> {
  const { data, error } = await supabaseAdmin
    .from("product_review_summaries")
    .select("review_count, average_rating, positive_points, negative_points, recommended_for")
    .eq("product_id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(`product_review_summaries lookup failed: ${error.message}`);
  }
  return (data as ProductReviewSummaryRow | null) ?? null;
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
