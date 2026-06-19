import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TravelBooking, TravelBookingStatus } from "@/types/travelBooking";

export function toTravelBooking(row: Record<string, unknown>): TravelBooking {
  return {
    id: String(row.id ?? ""),
    booking_number: String(row.booking_number ?? ""),
    customer_profile_id: String(row.customer_profile_id ?? ""),
    inquiry_id: row.inquiry_id != null ? String(row.inquiry_id) : null,
    member_id: typeof row.member_id === "string" ? row.member_id : null,
    product_id: typeof row.product_id === "string" ? row.product_id : null,
    product_title: typeof row.product_title === "string" ? row.product_title : null,
    source_path: typeof row.source_path === "string" ? row.source_path : null,
    booking_status: (row.booking_status as TravelBookingStatus) ?? "reserved",
    departure_date: typeof row.departure_date === "string" ? row.departure_date : null,
    return_date: typeof row.return_date === "string" ? row.return_date : null,
    travel_completed_at: typeof row.travel_completed_at === "string" ? row.travel_completed_at : null,
    traveler_count: Number(row.traveler_count ?? 1),
    payer_name: typeof row.payer_name === "string" ? row.payer_name : null,
    primary_traveler_phone: typeof row.primary_traveler_phone === "string" ? row.primary_traveler_phone : null,
    payment_status: (row.payment_status as TravelBooking["payment_status"]) ?? "unpaid",
    payment_method: typeof row.payment_method === "string" ? row.payment_method : null,
    payment_total_amount: row.payment_total_amount != null ? Number(row.payment_total_amount) : null,
    payment_paid_amount: Number(row.payment_paid_amount ?? 0),
    payment_confirmed_at: typeof row.payment_confirmed_at === "string" ? row.payment_confirmed_at : null,
    shipping_name: typeof row.shipping_name === "string" ? row.shipping_name : null,
    shipping_phone: typeof row.shipping_phone === "string" ? row.shipping_phone : null,
    shipping_zip: typeof row.shipping_zip === "string" ? row.shipping_zip : null,
    shipping_address1: typeof row.shipping_address1 === "string" ? row.shipping_address1 : null,
    shipping_address2: typeof row.shipping_address2 === "string" ? row.shipping_address2 : null,
    confirmed_at: typeof row.confirmed_at === "string" ? row.confirmed_at : null,
    confirmed_by_admin_id: typeof row.confirmed_by_admin_id === "string" ? row.confirmed_by_admin_id : null,
    booking_confirmed_sms_sent_at:
      typeof row.booking_confirmed_sms_sent_at === "string" ? row.booking_confirmed_sms_sent_at : null,
    trip_completed_sms_sent_at:
      typeof row.trip_completed_sms_sent_at === "string" ? row.trip_completed_sms_sent_at : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

export async function getTravelBookingById(bookingId: string): Promise<TravelBooking | null> {
  const { data, error } = await supabaseAdmin
    .from("travel_bookings")
    .select("*")
    .eq("id", bookingId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toTravelBooking(data as Record<string, unknown>);
}

export async function getTravelBookingByInquiryId(inquiryId: string): Promise<TravelBooking | null> {
  const { data, error } = await supabaseAdmin
    .from("travel_bookings")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .neq("booking_status", "canceled")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toTravelBooking(data as Record<string, unknown>);
}

export async function getProductIdByBookingId(bookingId: string): Promise<string | null> {
  const booking = await getTravelBookingById(bookingId);
  return booking?.product_id ?? null;
}

export async function updateTravelBookingStatus(
  bookingId: string,
  status: TravelBookingStatus,
  options?: { travel_completed_at?: string | null },
): Promise<boolean> {
  const update: Record<string, unknown> = {
    booking_status: status,
    updated_at: new Date().toISOString(),
  };
  if (options?.travel_completed_at !== undefined) {
    update.travel_completed_at = options.travel_completed_at;
  }

  const { error } = await supabaseAdmin.from("travel_bookings").update(update).eq("id", bookingId);
  return !error;
}
