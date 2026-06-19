import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type Body = {
  amount: number;
  method?: string;
  admin_memo?: string;
  external_provider?: string;
  external_payment_id?: string;
};

/** 수기 결제 기록 (PG stub) */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const { id: bookingId } = await context.params;

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "amount는 1 이상이어야 합니다." }, { status: 400 });
  }

  const { data: booking } = await supabaseAdmin
    .from("travel_bookings")
    .select("id, payment_total_amount, payment_paid_amount")
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) {
    return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
  }

  const { error: payErr } = await supabaseAdmin.from("booking_payments").insert({
    booking_id: bookingId,
    amount,
    method: body.method?.trim() || "transfer",
    status: "recorded",
    external_provider: body.external_provider?.trim() || null,
    external_payment_id: body.external_payment_id?.trim() || null,
    recorded_by: "ADMIN",
    admin_memo: body.admin_memo?.trim() || null,
  });

  if (payErr) {
    return NextResponse.json({ message: "결제 기록에 실패했습니다." }, { status: 500 });
  }

  const prevPaid = Number((booking as { payment_paid_amount?: number }).payment_paid_amount ?? 0);
  const total = Number((booking as { payment_total_amount?: number }).payment_total_amount ?? 0);
  const newPaid = prevPaid + amount;
  let paymentStatus = "partial";
  if (total > 0 && newPaid >= total) paymentStatus = "paid";
  else if (newPaid <= 0) paymentStatus = "unpaid";

  await supabaseAdmin
    .from("travel_bookings")
    .update({
      payment_paid_amount: newPaid,
      payment_status: paymentStatus,
      payment_method: body.method?.trim() || null,
      payment_confirmed_at: paymentStatus === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", bookingId);

  return NextResponse.json({ message: "결제가 기록되었습니다.", payment_paid_amount: newPaid, payment_status: paymentStatus });
}
