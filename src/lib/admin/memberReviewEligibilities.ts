/**
 * 관리자 회원 상세: 리뷰 권한·문의·예약 조회
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findCustomerProfilesByMemberId } from "@/lib/customerAccountLinks";
import { normalizePhone } from "@/lib/customerProfiles";

export type MemberReviewEligibilityRow = {
  eligibility_id: string | null;
  eligibility_status: string | null;
  claimed_by_member_id: string | null;
  inquiry_id: string | null;
  inquiry_created_at: string | null;
  product_title: string | null;
  product_id: string | null;
  booking_status: string | null;
  booking_id: string | null;
  departure_date: string | null;
  return_date: string | null;
  customer_profile_id: string;
  can_claim: boolean;
  claim_reason: string | null;
};

export type MemberReviewEligibilitySummary = {
  linkedProfiles: Array<{ id: string; name: string; phone: string }>;
  rows: MemberReviewEligibilityRow[];
  phoneMatchInquiries: Array<{
    id: string;
    name: string;
    phone: string;
    product_title: string | null;
    booking_status: string | null;
    customer_profile_id: string | null;
    created_at: string | null;
  }>;
};

export async function getMemberReviewEligibilitySummary(
  memberId: string,
  memberPhone: string,
): Promise<MemberReviewEligibilitySummary> {
  const linkedProfiles = await findCustomerProfilesByMemberId(memberId);
  const profileIds = linkedProfiles.map((p) => p.id);

  const rows: MemberReviewEligibilityRow[] = [];

  if (profileIds.length > 0) {
    const { data: bookings } = await supabaseAdmin
      .from("travel_bookings")
      .select(`
        id,
        inquiry_id,
        product_id,
        product_title,
        booking_status,
        departure_date,
        return_date,
        customer_profile_id,
        review_eligibilities (
          id,
          status,
          claimed_by_member_id
        )
      `)
      .in("customer_profile_id", profileIds)
      .order("created_at", { ascending: false });

    for (const b of bookings ?? []) {
      const booking = b as Record<string, unknown>;
      const eligibilities = booking.review_eligibilities as Record<string, unknown>[] | Record<string, unknown> | null;
      const eligList = Array.isArray(eligibilities)
        ? eligibilities
        : eligibilities
          ? [eligibilities]
          : [];

      const eligibility = eligList[0] as Record<string, unknown> | undefined;
      const bookingStatus = typeof booking.booking_status === "string" ? booking.booking_status : null;
      const eligibilityStatus = typeof eligibility?.status === "string" ? eligibility.status : null;
      const claimedBy =
        typeof eligibility?.claimed_by_member_id === "string" ? eligibility.claimed_by_member_id : null;

      let canClaim = false;
      let claimReason: string | null = null;

      if (!eligibility) {
        if (bookingStatus === "reserved") {
          claimReason = "여행 완료 처리 후 자동 부여됩니다 (회원 연결됨)";
        } else if (bookingStatus === "completed") {
          claimReason = "여행 완료됐으나 후기 자격이 없습니다. complete_trip을 다시 확인해 주세요.";
        } else {
          claimReason = "예약 확정 후 여행 완료 시 리뷰 작성 가능";
        }
      } else if (eligibilityStatus === "submitted") {
        claimReason = "이미 후기 작성 완료";
      } else if (claimedBy === memberId) {
        claimReason = "마이페이지에서 작성 가능";
      } else if (claimedBy) {
        claimReason = "다른 회원에게 부여됨";
      } else if (bookingStatus === "completed" || eligibilityStatus === "eligible") {
        canClaim = true;
        claimReason = "권한 부여 가능";
      } else {
        claimReason = "여행 완료 후 권한 부여 가능";
      }

      let inquiryCreatedAt: string | null = null;
      const inquiryId = booking.inquiry_id != null ? String(booking.inquiry_id) : null;
      if (inquiryId) {
        const { data: inq } = await supabaseAdmin
          .from("inquiries")
          .select("created_at")
          .eq("id", inquiryId)
          .maybeSingle();
        inquiryCreatedAt = inq?.created_at ? String(inq.created_at) : null;
      }

      rows.push({
        eligibility_id: eligibility?.id ? String(eligibility.id) : null,
        eligibility_status: eligibilityStatus,
        claimed_by_member_id: claimedBy,
        inquiry_id: inquiryId,
        inquiry_created_at: inquiryCreatedAt,
        product_title: typeof booking.product_title === "string" ? booking.product_title : null,
        product_id: typeof booking.product_id === "string" ? booking.product_id : null,
        booking_status: bookingStatus,
        booking_id: String(booking.id ?? ""),
        departure_date: typeof booking.departure_date === "string" ? booking.departure_date : null,
        return_date: typeof booking.return_date === "string" ? booking.return_date : null,
        customer_profile_id: String(booking.customer_profile_id ?? ""),
        can_claim: canClaim,
        claim_reason: claimReason,
      });
    }

    const { data: inquiriesWithoutBooking } = await supabaseAdmin
      .from("inquiries")
      .select("id, product_title, product_id, booking_status, created_at, customer_profile_id")
      .in("customer_profile_id", profileIds)
      .order("created_at", { ascending: false });

    const bookedInquiryIds = new Set(rows.map((r) => r.inquiry_id).filter(Boolean));
    for (const inq of inquiriesWithoutBooking ?? []) {
      const inquiryId = String(inq.id ?? "");
      if (bookedInquiryIds.has(inquiryId)) continue;
      rows.push({
        eligibility_id: null,
        eligibility_status: null,
        claimed_by_member_id: null,
        inquiry_id: inquiryId,
        inquiry_created_at: inq.created_at ? String(inq.created_at) : null,
        product_title: typeof inq.product_title === "string" ? inq.product_title : null,
        product_id: typeof inq.product_id === "string" ? inq.product_id : null,
        booking_status: typeof inq.booking_status === "string" ? inq.booking_status : "none",
        booking_id: null,
        departure_date: null,
        return_date: null,
        customer_profile_id: inq.customer_profile_id ? String(inq.customer_profile_id) : "",
        can_claim: false,
        claim_reason: "예약 확정 후 여행 완료 시 리뷰 작성 가능",
      });
    }
  }

  rows.sort((a, b) => {
    const ta = a.inquiry_created_at ?? "";
    const tb = b.inquiry_created_at ?? "";
    return tb.localeCompare(ta);
  });

  const normalizedPhone = normalizePhone(memberPhone);
  let phoneMatchInquiries: MemberReviewEligibilitySummary["phoneMatchInquiries"] = [];

  if (normalizedPhone) {
    const { data: phoneInquiries } = await supabaseAdmin
      .from("inquiries")
      .select("id, name, phone, product_title, booking_status, customer_profile_id, created_at")
      .eq("phone", normalizedPhone)
      .order("created_at", { ascending: false })
      .limit(10);

    phoneMatchInquiries = (phoneInquiries ?? []).map((inq) => ({
      id: String(inq.id ?? ""),
      name: String(inq.name ?? ""),
      phone: String(inq.phone ?? ""),
      product_title: typeof inq.product_title === "string" ? inq.product_title : null,
      booking_status: typeof inq.booking_status === "string" ? inq.booking_status : null,
      customer_profile_id: inq.customer_profile_id ? String(inq.customer_profile_id) : null,
      created_at: inq.created_at ? String(inq.created_at) : null,
    }));
  }

  return {
    linkedProfiles: linkedProfiles.map((p) => ({ id: p.id, name: p.name, phone: p.phone })),
    rows,
    phoneMatchInquiries,
  };
}
