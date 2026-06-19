import "server-only";

import { getPointExpiresAt } from "@/config/rewardPolicy";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { EARN_REQUEST_MESSAGE_TEMPLATES } from "@/server/services/points/earnRequests";

export async function grantRewardFromBooking(bookingId: string, options?: { admin_memo?: string }) {
  const { data: booking, error: bookErr } = await supabaseAdmin
    .from("travel_bookings")
    .select(
      "id, booking_number, booking_status, traveler_count, payer_name, member_id, customer_profile_id, shipping_name, shipping_phone, shipping_zip, shipping_address1, shipping_address2, primary_traveler_phone",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (bookErr || !booking) {
    throw new Error("예약을 찾을 수 없습니다.");
  }

  const b = booking as Record<string, unknown>;
  if (b.booking_status !== "completed" && b.booking_status !== "reserved") {
    throw new Error("완료 또는 확정된 예약만 리워드 지급할 수 있습니다.");
  }

  let userId = typeof b.member_id === "string" ? b.member_id : null;
  if (!userId && b.customer_profile_id) {
    const { data: link } = await supabaseAdmin
      .from("customer_account_links")
      .select("member_id")
      .eq("customer_profile_id", b.customer_profile_id)
      .limit(1)
      .maybeSingle();
    userId = (link as { member_id?: string } | null)?.member_id ?? null;
  }

  if (!userId) {
    throw new Error("연결된 회원이 없어 리워드를 지급할 수 없습니다. 회원 연결 후 다시 시도해 주세요.");
  }

  const { data: existingEarn } = await supabaseAdmin
    .from("point_earn_requests")
    .select("id, status")
    .eq("booking_id", bookingId)
    .in("status", ["REQUESTED", "APPROVED"])
    .limit(1)
    .maybeSingle();

  if (existingEarn) {
    throw new Error("이 예약에 대한 리워드 지급 요청이 이미 있습니다.");
  }

  const bookingNumber = String(b.booking_number);
  const travelerCount = Number(b.traveler_count ?? 1);
  const departureDate = new Date().toISOString().slice(0, 10);

  const { data: earnRow, error: earnErr } = await supabaseAdmin
    .from("point_earn_requests")
    .insert({
      user_id: userId,
      booking_id: bookingId,
      status: "REQUESTED",
      booking_ref: bookingNumber,
      departure_date: departureDate,
      payer_name: String(b.payer_name ?? "예약자"),
      traveler_count: travelerCount,
      shipping_name: String(b.shipping_name ?? b.payer_name ?? ""),
      shipping_phone: String(b.shipping_phone ?? b.primary_traveler_phone ?? ""),
      shipping_zip: (b.shipping_zip as string) || null,
      shipping_address1: String(b.shipping_address1 ?? ""),
      shipping_address2: (b.shipping_address2 as string) || null,
      admin_memo: options?.admin_memo?.trim() || null,
    })
    .select("id")
    .maybeSingle();

  if (earnErr || !earnRow) {
    throw new Error("리워드 요청 생성에 실패했습니다.");
  }

  const earnId = (earnRow as { id: string }).id;

  const { data: rpcData, error: rpcErr } = await supabaseAdmin.rpc("approve_point_earn_request", {
    p_request_id: earnId,
    p_admin_memo: options?.admin_memo?.trim() || null,
    p_expires_at: getPointExpiresAt(),
    p_decided_by: "ADMIN",
  });

  if (rpcErr) {
    await supabaseAdmin.from("point_earn_requests").delete().eq("id", earnId);
    throw new Error(rpcErr.message || "포인트 지급에 실패했습니다.");
  }

  const amount = Number((rpcData as { amount?: number })?.amount ?? travelerCount * 20000);

  await supabaseAdmin.from("notifications").insert({
    user_id: userId,
    type: "ADMIN_MESSAGE",
    title: "예약 리워드 지급",
    body: EARN_REQUEST_MESSAGE_TEMPLATES.approved(amount, travelerCount),
  });

  return { earn_request_id: earnId, amount, traveler_count: travelerCount, booking_number: bookingNumber };
}
