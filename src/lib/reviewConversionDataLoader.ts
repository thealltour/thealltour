/**
 * PR27: review_experiment_events 테이블에서 이벤트 로드 후 ReviewInteractionEvent 형태로 정규화.
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ReviewInteractionEvent, ReviewConversionEventType } from "@/types/reviewConversionAnalytics";

type DbRow = {
  id: string;
  experiment_key: string;
  variant: string;
  product_id: string;
  event_type: string;
  review_id: string | null;
  session_key: string | null;
  occurred_at: string;
};

const PR26_TO_PR27_EVENT: Record<string, ReviewConversionEventType> = {
  impression: "review_impression",
  click_review: "review_click",
  expand_review: "review_expand",
  click_helpful: "review_helpful_click",
  view_summary: "review_summary_view",
  conversion: "product_conversion",
  personalized_review_view: "personalized_review_view",
  product_cta_click: "product_cta_click",
  product_inquiry: "product_inquiry",
  product_booking_start: "product_booking_start",
  product_conversion: "product_conversion",
};

export async function loadReviewConversionEvents(options?: {
  since?: string;
  limit?: number;
  productId?: string;
}): Promise<ReviewInteractionEvent[]> {
  let query = supabaseAdmin
    .from("review_experiment_events")
    .select("id, experiment_key, variant, product_id, event_type, review_id, session_key, occurred_at")
    .order("occurred_at", { ascending: true });

  if (options?.since) {
    query = query.gte("occurred_at", options.since);
  }
  if (options?.productId) {
    query = query.eq("product_id", options.productId);
  }
  const limit = Math.min(options?.limit ?? 10000, 50000);
  const { data, error } = await query.limit(limit);

  if (error || !data?.length) {
    return [];
  }

  return (data as DbRow[]).map((row) => {
    const eventType = PR26_TO_PR27_EVENT[row.event_type] ?? (row.event_type as ReviewConversionEventType);
    return {
      eventId: row.id,
      sessionKey: row.session_key ?? undefined,
      productId: row.product_id,
      reviewId: row.review_id ?? undefined,
      experimentKey: row.experiment_key || undefined,
      variant: row.variant || undefined,
      eventType,
      createdAt: row.occurred_at,
    };
  });
}
