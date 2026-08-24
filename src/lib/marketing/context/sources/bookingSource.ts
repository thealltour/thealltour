import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TravelBookingInsightRow } from "@/lib/marketing/context/mappers/bookingInsightMapper";

const BOOKING_INSIGHT_COLUMNS = [
  "booking_status",
  "traveler_count",
  "payment_total_amount",
  "product_id",
  "departure_date",
].join(", ");

export async function fetchBookingInsightRows(input: {
  productId?: string;
  periodStart: string;
  periodEnd: string;
  bookingStatus?: string;
  limit?: number;
}): Promise<TravelBookingInsightRow[]> {
  let query = supabaseAdmin
    .from("travel_bookings")
    .select(BOOKING_INSIGHT_COLUMNS)
    .gte("created_at", input.periodStart)
    .lte("created_at", input.periodEnd)
    .order("created_at", { ascending: false })
    .limit(input.limit ?? 500);

  if (input.productId) {
    query = query.eq("product_id", input.productId);
  }
  if (input.bookingStatus) {
    query = query.eq("booking_status", input.bookingStatus);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`travel_bookings lookup failed: ${error.message}`);
  }
  return (data as TravelBookingInsightRow[] | null) ?? [];
}
