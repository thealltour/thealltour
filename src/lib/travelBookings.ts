/**
 * @deprecated Import from @/lib/bookings/bookingRepository instead.
 */
export {
  getTravelBookingById,
  getTravelBookingByInquiryId,
  getProductIdByBookingId,
  updateTravelBookingStatus,
  toTravelBooking,
} from "@/lib/bookings/bookingRepository";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TravelBookingInput } from "@/types/travelBooking";
import { toTravelBooking } from "@/lib/bookings/bookingRepository";

/** @deprecated confirmTravelBooking / createStandaloneTravelBooking 사용 */
export async function createTravelBooking(input: TravelBookingInput) {
  const payload = {
    customer_profile_id: input.customer_profile_id,
    inquiry_id: input.inquiry_id ?? null,
    product_id: input.product_id ?? null,
    product_title: input.product_title ?? null,
    source_path: input.source_path ?? null,
    booking_status: input.booking_status ?? "reserved",
    departure_date: input.departure_date ?? null,
    return_date: input.return_date ?? null,
    travel_completed_at: input.travel_completed_at ?? null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabaseAdmin
    .from("travel_bookings")
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return toTravelBooking(data as Record<string, unknown>);
}
