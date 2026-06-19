import "server-only";

import { adminClaimEligibilityById, createEligibilityIfNotExists } from "@/lib/reviewEligibilities";
import { createReviewReminders } from "@/lib/reviewReminders";
import { findLinkedMemberIdByCustomerProfileId } from "@/lib/customerAccountLinks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getTravelBookingById as getTravelBookingRowById,
  getTravelBookingByInquiryId as getTravelBookingRowByInquiryId,
} from "@/lib/bookings/bookingRepository";
import type { CompleteTravelBookingResult } from "@/types/travelBooking";

export async function completeTravelBooking(
  bookingId: string,
  options?: { completed_by?: string },
): Promise<CompleteTravelBookingResult> {
  const { data, error } = await supabaseAdmin.rpc("complete_travel_booking", {
    p_booking_id: bookingId,
    p_completed_by: options?.completed_by ?? "ADMIN",
  });

  if (error) {
    if (error.message.includes("BOOKING_NOT_FOUND")) {
      throw new Error("예약을 찾을 수 없습니다.");
    }
    if (error.message.includes("INVALID_BOOKING_STATUS")) {
      throw new Error("예약 확정 상태의 예약만 완료 처리할 수 있습니다.");
    }
    throw new Error(error.message || "여행 완료 처리에 실패했습니다.");
  }

  const row = data as CompleteTravelBookingResult;
  const customerProfileId = String(row.customer_profile_id);

  const eligibility = await createEligibilityIfNotExists(bookingId, customerProfileId, {
    withClaimToken: true,
  });

  let claimToken: string | null = null;
  if (eligibility) {
    claimToken = eligibility.claim_token ?? null;
    const linkedMemberId = await findLinkedMemberIdByCustomerProfileId(customerProfileId);
    if (linkedMemberId && !eligibility.claimed_by_member_id) {
      await adminClaimEligibilityById(eligibility.id, linkedMemberId);
    }
    await createReviewReminders(eligibility);
  }

  return {
    booking_id: String(row.booking_id),
    booking_number: String(row.booking_number),
    inquiry_id: row.inquiry_id != null ? String(row.inquiry_id) : null,
    customer_profile_id: customerProfileId,
    claim_token: claimToken,
    claim_link: claimToken ? `/reviews/claim/${claimToken}` : null,
  };
}

export async function getTravelBookingById(bookingId: string) {
  const booking = await getTravelBookingRowById(bookingId);
  return booking as Record<string, unknown> | null;
}

export async function getTravelBookingByNumber(bookingNumber: string) {
  const { data, error } = await supabaseAdmin
    .from("travel_bookings")
    .select("*")
    .eq("booking_number", bookingNumber.trim())
    .maybeSingle();
  if (error || !data) return null;
  return data as Record<string, unknown>;
}

export async function getTravelBookingByInquiryId(inquiryId: number | string) {
  const booking = await getTravelBookingRowByInquiryId(String(inquiryId));
  return booking as Record<string, unknown> | null;
}

export async function listBookingTravelers(bookingId: string) {
  const { data } = await supabaseAdmin
    .from("booking_travelers")
    .select("*")
    .eq("booking_id", bookingId)
    .order("sort_order", { ascending: true });
  return data ?? [];
}

export async function listBookingPayments(bookingId: string) {
  const { data } = await supabaseAdmin
    .from("booking_payments")
    .select("*")
    .eq("booking_id", bookingId)
    .order("recorded_at", { ascending: false });
  return data ?? [];
}
