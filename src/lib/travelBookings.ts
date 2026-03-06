/**
 * 여행 예약/완료 건 생성·조회·상태 업데이트.
 * 후속 PR에서 관리자 UI에서 직접 활용.
 * 서버 전용: RLS로 anon 직접 접근이 막혀 있으므로 supabaseAdmin(service_role) 사용.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { TravelBooking, TravelBookingInput, TravelBookingStatus } from "@/types/travelBooking";

function toBooking(row: Record<string, unknown>): TravelBooking {
  return {
    id: String(row.id ?? ""),
    customer_profile_id: String(row.customer_profile_id ?? ""),
    inquiry_id: typeof row.inquiry_id === "string" ? row.inquiry_id : null,
    product_id: typeof row.product_id === "string" ? row.product_id : null,
    product_title: typeof row.product_title === "string" ? row.product_title : null,
    source_path: typeof row.source_path === "string" ? row.source_path : null,
    booking_status: (row.booking_status as TravelBookingStatus) ?? "reserved",
    departure_date: typeof row.departure_date === "string" ? row.departure_date : null,
    return_date: typeof row.return_date === "string" ? row.return_date : null,
    travel_completed_at: typeof row.travel_completed_at === "string" ? row.travel_completed_at : null,
    created_at: String(row.created_at ?? ""),
    updated_at: String(row.updated_at ?? ""),
  };
}

/** 예약 건 생성 */
export async function createTravelBooking(
  input: TravelBookingInput,
): Promise<TravelBooking | null> {
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
  return toBooking(data as Record<string, unknown>);
}

/** inquiry_id로 예약 1건 조회 */
export async function getTravelBookingByInquiryId(
  inquiryId: string,
): Promise<TravelBooking | null> {
  const { data, error } = await supabaseAdmin
    .from("travel_bookings")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return toBooking(data as Record<string, unknown>);
}

/** 예약 상태 업데이트 (booking_status, 필요 시 travel_completed_at) */
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
