import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  buildMemberPointUpdatePayload,
  fetchMemberPoints,
} from "@/server/services/rewards/memberPoints";
import { BOOKING_BALANCE_REF_TYPE, BOOKING_DEPOSIT_REF_TYPE } from "@/types/checkout";

export async function reserveBookingPoints(params: {
  memberId: string;
  bookingId: string;
  amount: number;
  refType?: typeof BOOKING_DEPOSIT_REF_TYPE | typeof BOOKING_BALANCE_REF_TYPE;
}): Promise<void> {
  const amount = Math.floor(params.amount);
  if (amount <= 0) return;

  const refType = params.refType ?? BOOKING_DEPOSIT_REF_TYPE;

  const { data: existing } = await supabaseAdmin
    .from("point_ledger")
    .select("id")
    .eq("user_id", params.memberId)
    .eq("type", "RESERVE")
    .eq("ref_type", refType)
    .eq("ref_id", params.bookingId)
    .eq("status", "CONFIRMED")
    .maybeSingle();

  if (existing) return;

  const { balance, row } = await fetchMemberPoints(supabaseAdmin, params.memberId);
  if (amount > balance) {
    throw new Error("포인트 잔액이 부족합니다.");
  }

  const nextBalance = balance - amount;

  const { error: ledgerErr } = await supabaseAdmin.from("point_ledger").insert({
    user_id: params.memberId,
    type: "RESERVE",
    status: "CONFIRMED",
    amount,
    reason: "예약 결제 포인트 예약",
    ref_type: refType,
    ref_id: params.bookingId,
  });

  if (ledgerErr) throw new Error("포인트 예약 기록에 실패했습니다.");

  const { error: memberErr } = await supabaseAdmin
    .from("members")
    .update(buildMemberPointUpdatePayload(row, nextBalance))
    .eq("id", params.memberId);

  if (memberErr) throw new Error("포인트 차감에 실패했습니다.");
}

export async function confirmReservedBookingPoints(params: {
  memberId: string;
  bookingId: string;
  amount: number;
}): Promise<void> {
  const amount = Math.floor(params.amount);
  if (amount <= 0) return;

  const { data: reserveRow } = await supabaseAdmin
    .from("point_ledger")
    .select("id")
    .eq("user_id", params.memberId)
    .eq("type", "RESERVE")
    .eq("ref_type", BOOKING_DEPOSIT_REF_TYPE)
    .eq("ref_id", params.bookingId)
    .eq("status", "CONFIRMED")
    .maybeSingle();

  if (!reserveRow) return;

  const { data: useExisting } = await supabaseAdmin
    .from("point_ledger")
    .select("id")
    .eq("user_id", params.memberId)
    .eq("type", "USE")
    .eq("ref_type", BOOKING_BALANCE_REF_TYPE)
    .eq("ref_id", params.bookingId)
    .maybeSingle();

  if (useExisting) return;

  await supabaseAdmin.from("point_ledger").insert({
    user_id: params.memberId,
    type: "USE",
    status: "CONFIRMED",
    amount,
    reason: "예약 잔금 결제 포인트 사용",
    ref_type: BOOKING_BALANCE_REF_TYPE,
    ref_id: params.bookingId,
  });
}

export async function getReservedPointsForBooking(
  memberId: string,
  bookingId: string,
): Promise<number> {
  const { data } = await supabaseAdmin
    .from("point_ledger")
    .select("amount")
    .eq("user_id", memberId)
    .eq("type", "RESERVE")
    .eq("ref_type", BOOKING_DEPOSIT_REF_TYPE)
    .eq("ref_id", bookingId)
    .eq("status", "CONFIRMED")
    .maybeSingle();

  return Number(data?.amount ?? 0);
}
