import "server-only";

import { findCustomerProfilesByMemberId } from "@/lib/customerAccountLinks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const CONFIRMED_STATUSES = ["reserved", "completed"] as const;

/**
 * 회원(및 연결된 customer_profile)에 확정 예약(reserved|completed)이 있는지.
 * pending_deposit·canceled는 제외 — 미결제 이탈이 RETURNING으로 잡히지 않게 함.
 */
export async function memberHasConfirmedBooking(memberId: string): Promise<boolean> {
  const id = memberId.trim();
  if (!id) return false;

  const profiles = await findCustomerProfilesByMemberId(id);
  const profileIds = profiles.map((p) => p.id).filter(Boolean);

  let query = supabaseAdmin
    .from("travel_bookings")
    .select("id", { count: "exact", head: true })
    .in("booking_status", [...CONFIRMED_STATUSES])
    .limit(1);

  if (profileIds.length > 0) {
    query = query.or(`member_id.eq.${id},customer_profile_id.in.(${profileIds.join(",")})`);
  } else {
    query = query.eq("member_id", id);
  }

  const { count, error } = await query;
  if (error) {
    console.error("[memberHasConfirmedBooking]", error.message);
    return false;
  }
  return (count ?? 0) > 0;
}
