/**
 * 후기 작성 자격(eligibility) 생성·조회.
 * 여행건 기준 생성, 후속 PR에서 회원 claim 플로우 연결.
 * 서버 전용: RLS로 anon 직접 접근이 막혀 있으므로 supabaseAdmin(service_role) 사용.
 * @see docs/PR1-follow-up-todos.md 후속 PR TODO 목록
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type {
  ReviewEligibility,
  ReviewEligibilityInput,
  ReviewEligibilityStatus,
} from "@/types/reviewEligibility";

const STATUS_DEFAULT: ReviewEligibilityStatus = "eligible";

function toEligibility(row: Record<string, unknown>): ReviewEligibility {
  return {
    id: String(row.id ?? ""),
    booking_id: String(row.booking_id ?? ""),
    customer_profile_id: String(row.customer_profile_id ?? ""),
    status: (row.status as ReviewEligibilityStatus) ?? STATUS_DEFAULT,
    review_open_at: String(row.review_open_at ?? ""),
    review_deadline_at: typeof row.review_deadline_at === "string" ? row.review_deadline_at : null,
    claimed_by_member_id: typeof row.claimed_by_member_id === "string" ? row.claimed_by_member_id : null,
    claimed_at: typeof row.claimed_at === "string" ? row.claimed_at : null,
    claim_token: typeof row.claim_token === "string" ? row.claim_token : null,
    claim_token_expires_at: typeof row.claim_token_expires_at === "string" ? row.claim_token_expires_at : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** 자격 1건 생성. booking_id 유니크 제약으로 중복 생성 시 실패 */
export async function createReviewEligibility(
  input: ReviewEligibilityInput,
): Promise<ReviewEligibility | null> {
  const payload: Record<string, unknown> = {
    booking_id: input.booking_id,
    customer_profile_id: input.customer_profile_id,
    status: input.status ?? STATUS_DEFAULT,
    review_open_at: input.review_open_at ?? new Date().toISOString(),
    review_deadline_at: input.review_deadline_at ?? null,
    updated_at: new Date().toISOString(),
  };

  if (input.claim_token) {
    payload.claim_token = input.claim_token;
  }
  if (input.claim_token_expires_at) {
    payload.claim_token_expires_at = input.claim_token_expires_at;
  }

  const { data, error } = await supabaseAdmin
    .from("review_eligibilities")
    .insert(payload)
    .select("*")
    .maybeSingle();

  if (error || !data) return null;
  return toEligibility(data as Record<string, unknown>);
}

/** booking_id로 자격 1건 조회 */
export async function getEligibilityByBookingId(
  bookingId: string,
): Promise<ReviewEligibility | null> {
  const { data, error } = await supabaseAdmin
    .from("review_eligibilities")
    .select("*")
    .eq("booking_id", bookingId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toEligibility(data as Record<string, unknown>);
}

/** Claim Token 생성 (UUID v4 형식) */
export function generateClaimToken(): string {
  return crypto.randomUUID();
}

/** Claim Token 만료일 계산 (기본 90일) */
export function getClaimTokenExpiresAt(days = 90): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/** 이미 있으면 반환, 없으면 생성. booking_id 유니크로 중복 생성 방지 */
export async function createEligibilityIfNotExists(
  bookingId: string,
  customerProfileId: string,
  options?: {
    review_deadline_at?: string | null;
    withClaimToken?: boolean;
  },
): Promise<ReviewEligibility | null> {
  const existing = await getEligibilityByBookingId(bookingId);
  if (existing) return existing;

  const input: ReviewEligibilityInput = {
    booking_id: bookingId,
    customer_profile_id: customerProfileId,
    status: "eligible",
    review_open_at: new Date().toISOString(),
    review_deadline_at: options?.review_deadline_at ?? null,
  };

  if (options?.withClaimToken) {
    input.claim_token = generateClaimToken();
    input.claim_token_expires_at = getClaimTokenExpiresAt(90);
  }

  return createReviewEligibility(input);
}

/**
 * member_id로 자격 목록 조회.
 * 현재는 customer_account_links join 없이 review_eligibilities.claimed_by_member_id 기준만 조회.
 * 후속 PR에서 customer_account_links join으로 확장 가능하도록 함수 시그니처만 유지.
 */
export async function getEligibilitiesByMemberId(
  memberId: string,
): Promise<ReviewEligibility[]> {
  const { data, error } = await supabaseAdmin
    .from("review_eligibilities")
    .select("*")
    .eq("claimed_by_member_id", memberId)
    .order("created_at", { ascending: false });

  if (error) return [];
  return (data ?? []).map((row) => toEligibility(row as Record<string, unknown>));
}

/** 마이페이지 카드용 확장 타입 (travel_bookings join 결과) */
export type WritableEligibilityWithBooking = ReviewEligibility & {
  product_id: string | null;
  product_title: string | null;
  departure_date: string | null;
  return_date: string | null;
};

/**
 * 마이페이지용: 작성 가능한 자격 조회.
 * - claimed_by_member_id = memberId
 * - status in ('eligible', 'claimed')
 * - travel_bookings join으로 상품/일정 정보 포함
 */
export async function getWritableEligibilitiesByMemberId(
  memberId: string,
): Promise<WritableEligibilityWithBooking[]> {
  const { data, error } = await supabaseAdmin
    .from("review_eligibilities")
    .select(`
      *,
      travel_bookings (
        product_id,
        product_title,
        departure_date,
        return_date
      )
    `)
    .eq("claimed_by_member_id", memberId)
    .in("status", ["eligible", "claimed"])
    .order("created_at", { ascending: false });

  if (error) return [];

  return (data ?? []).map((row) => {
    const base = toEligibility(row as Record<string, unknown>);
    const booking = row.travel_bookings as Record<string, unknown> | null;
    return {
      ...base,
      product_id: typeof booking?.product_id === "string" ? booking.product_id : null,
      product_title: typeof booking?.product_title === "string" ? booking.product_title : null,
      departure_date: typeof booking?.departure_date === "string" ? booking.departure_date : null,
      return_date: typeof booking?.return_date === "string" ? booking.return_date : null,
    };
  });
}

/** eligibility_id로 자격 1건 조회 */
export async function getEligibilityById(
  eligibilityId: string,
): Promise<ReviewEligibility | null> {
  const { data, error } = await supabaseAdmin
    .from("review_eligibilities")
    .select("*")
    .eq("id", eligibilityId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toEligibility(data as Record<string, unknown>);
}

/** eligibility 상태 업데이트 */
export async function updateEligibilityStatus(
  eligibilityId: string,
  status: ReviewEligibilityStatus,
): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("review_eligibilities")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", eligibilityId);

  return !error;
}

/** eligibility_id로 자격 조회 + travel_bookings join */
export async function getEligibilityWithBookingById(
  eligibilityId: string,
): Promise<WritableEligibilityWithBooking | null> {
  const { data, error } = await supabaseAdmin
    .from("review_eligibilities")
    .select(`
      *,
      travel_bookings (
        product_id,
        product_title,
        departure_date,
        return_date
      )
    `)
    .eq("id", eligibilityId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const base = toEligibility(data as Record<string, unknown>);
  const booking = data.travel_bookings as Record<string, unknown> | null;
  return {
    ...base,
    product_id: typeof booking?.product_id === "string" ? booking.product_id : null,
    product_title: typeof booking?.product_title === "string" ? booking.product_title : null,
    departure_date: typeof booking?.departure_date === "string" ? booking.departure_date : null,
    return_date: typeof booking?.return_date === "string" ? booking.return_date : null,
  };
}

/** claim_token으로 자격 1건 조회 */
export async function getEligibilityByClaimToken(
  claimToken: string,
): Promise<ReviewEligibility | null> {
  if (!claimToken) return null;

  const { data, error } = await supabaseAdmin
    .from("review_eligibilities")
    .select("*")
    .eq("claim_token", claimToken)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toEligibility(data as Record<string, unknown>);
}

/** claim_token으로 자격 조회 + travel_bookings join */
export async function getEligibilityWithBookingByClaimToken(
  claimToken: string,
): Promise<WritableEligibilityWithBooking | null> {
  if (!claimToken) return null;

  const { data, error } = await supabaseAdmin
    .from("review_eligibilities")
    .select(`
      *,
      travel_bookings (
        product_id,
        product_title,
        departure_date,
        return_date
      )
    `)
    .eq("claim_token", claimToken)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const base = toEligibility(data as Record<string, unknown>);
  const booking = data.travel_bookings as Record<string, unknown> | null;
  return {
    ...base,
    product_id: typeof booking?.product_id === "string" ? booking.product_id : null,
    product_title: typeof booking?.product_title === "string" ? booking.product_title : null,
    departure_date: typeof booking?.departure_date === "string" ? booking.departure_date : null,
    return_date: typeof booking?.return_date === "string" ? booking.return_date : null,
  };
}

export type ClaimResult =
  | { success: true; eligibility_id: string }
  | { success: false; error: "not_found" | "expired" | "already_submitted" | "already_claimed_by_other" | "unknown" };

/**
 * Claim Token으로 후기 권한을 회원에게 연결.
 * - 토큰 존재 확인
 * - 만료 여부 확인
 * - 이미 submitted 상태면 차단
 * - 이미 다른 회원이 claim 했으면 차단
 * - 동일 회원이면 OK (중복 claim 허용)
 */
export async function claimEligibility(
  claimToken: string,
  memberId: string,
): Promise<ClaimResult> {
  const eligibility = await getEligibilityByClaimToken(claimToken);

  if (!eligibility) {
    return { success: false, error: "not_found" };
  }

  if (eligibility.claim_token_expires_at) {
    const expiresAt = new Date(eligibility.claim_token_expires_at);
    if (expiresAt < new Date()) {
      return { success: false, error: "expired" };
    }
  }

  if (eligibility.status === "submitted") {
    return { success: false, error: "already_submitted" };
  }

  if (eligibility.claimed_by_member_id) {
    if (eligibility.claimed_by_member_id === memberId) {
      return { success: true, eligibility_id: eligibility.id };
    }
    return { success: false, error: "already_claimed_by_other" };
  }

  const { error } = await supabaseAdmin
    .from("review_eligibilities")
    .update({
      claimed_by_member_id: memberId,
      status: "claimed",
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eligibility.id);

  if (error) {
    return { success: false, error: "unknown" };
  }

  return { success: true, eligibility_id: eligibility.id };
}

export type AdminClaimResult =
  | { success: true; eligibility_id: string }
  | {
      success: false;
      error: "not_found" | "already_submitted" | "already_claimed_by_other" | "blocked" | "expired" | "unknown";
    };

/**
 * 관리자/auto-claim: eligibility_id로 회원에게 후기 권한 부여.
 * claim_token 없이 claimed_by_member_id 직접 설정.
 */
export async function adminClaimEligibilityById(
  eligibilityId: string,
  memberId: string,
): Promise<AdminClaimResult> {
  const eligibility = await getEligibilityById(eligibilityId);
  if (!eligibility) {
    return { success: false, error: "not_found" };
  }

  if (eligibility.status === "submitted") {
    return { success: false, error: "already_submitted" };
  }
  if (eligibility.status === "blocked") {
    return { success: false, error: "blocked" };
  }
  if (eligibility.status === "expired") {
    return { success: false, error: "expired" };
  }

  if (eligibility.claimed_by_member_id) {
    if (eligibility.claimed_by_member_id === memberId) {
      return { success: true, eligibility_id: eligibility.id };
    }
    return { success: false, error: "already_claimed_by_other" };
  }

  const { error } = await supabaseAdmin
    .from("review_eligibilities")
    .update({
      claimed_by_member_id: memberId,
      status: "claimed",
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", eligibility.id);

  if (error) {
    return { success: false, error: "unknown" };
  }

  return { success: true, eligibility_id: eligibility.id };
}
