import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  BookingTravelerInput,
  ConfirmTravelBookingInput,
  ConfirmTravelBookingResult,
} from "@/types/travelBooking";

function travelersToJson(travelers: BookingTravelerInput[] | undefined) {
  return (travelers ?? []).map((t, i) => ({
    sort_order: t.sort_order ?? i + 1,
    full_name: t.full_name?.trim() || "여행자",
    phone: t.phone?.trim() || null,
    email: t.email?.trim() || null,
    passport_number: t.passport_number?.trim() || null,
    passport_expiry: t.passport_expiry?.trim() || null,
    birth_date: t.birth_date?.trim() || null,
    gender: t.gender?.trim() || null,
    nationality: t.nationality?.trim() || null,
    is_primary: t.is_primary ?? i === 0,
    is_payer: t.is_payer ?? false,
  }));
}

export async function confirmTravelBooking(
  input: ConfirmTravelBookingInput,
): Promise<ConfirmTravelBookingResult> {
  const payment = input.payment ?? {};
  const travelers = input.travelers ?? [];

  if (travelers.length === 0 && input.payer_name) {
    travelers.push({
      full_name: input.payer_name,
      phone: input.primary_traveler_phone,
      is_primary: true,
      is_payer: true,
    });
  }

  const { data, error } = await supabaseAdmin.rpc("confirm_travel_booking", {
    p_customer_profile_id: input.customer_profile_id,
    p_inquiry_id: input.inquiry_id ?? null,
    p_product_id: input.product_id ?? null,
    p_product_title: input.product_title ?? null,
    p_source_path: input.source_path ?? null,
    p_departure_date: input.departure_date,
    p_return_date: input.return_date,
    p_traveler_count: input.traveler_count,
    p_payer_name: input.payer_name ?? null,
    p_primary_traveler_phone: input.primary_traveler_phone ?? null,
    p_member_id: input.member_id ?? null,
    p_payment_status: payment.status ?? "unpaid",
    p_payment_method: payment.method ?? null,
    p_payment_total_amount: payment.total_amount ?? null,
    p_payment_paid_amount: payment.paid_amount ?? 0,
    p_shipping_name: input.shipping_name ?? null,
    p_shipping_phone: input.shipping_phone ?? null,
    p_shipping_zip: input.shipping_zip ?? null,
    p_shipping_address1: input.shipping_address1 ?? null,
    p_shipping_address2: input.shipping_address2 ?? null,
    p_travelers: travelersToJson(travelers),
    p_confirmed_by: input.confirmed_by ?? "ADMIN",
  });

  if (error) {
    if (error.message.includes("INQUIRY_ALREADY_BOOKED")) {
      throw new Error("이미 이 문의로 예약이 등록되어 있습니다.");
    }
    if (error.message.includes("CUSTOMER_PROFILE_REQUIRED")) {
      throw new Error("고객 프로필이 필요합니다.");
    }
    throw new Error(error.message || "예약 확정에 실패했습니다.");
  }

  const row = data as ConfirmTravelBookingResult;
  return {
    booking_id: String(row.booking_id),
    booking_number: String(row.booking_number),
    inquiry_id: row.inquiry_id != null ? String(row.inquiry_id) : null,
    traveler_count: Number(row.traveler_count),
  };
}
