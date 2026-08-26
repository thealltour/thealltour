import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMemberSession } from "@/lib/apiAuth";
import { confirmPortOneBookingPayment } from "@/lib/payments/confirmPortOneBookingPayment";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const bodySchema = z.object({
  paymentId: z.string().min(1),
});

/**
 * PortOne V2 브라우저 결제 직후 서버 확정.
 * GET api.portone.io/payments/{id} 검증은 confirmPortOneBookingPayment 내부에서 수행.
 * Webhook과 동일 함수를 쓰므로 멱등.
 */
export async function POST(request: Request) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const paymentId = body.paymentId.trim();

  const { data: paymentRow } = await supabaseAdmin
    .from("booking_payments")
    .select("booking_id")
    .eq("external_payment_id", paymentId)
    .maybeSingle();

  if (!paymentRow?.booking_id) {
    return NextResponse.json({ message: "결제 건을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: booking } = await supabaseAdmin
    .from("travel_bookings")
    .select("id, booking_number, member_id")
    .eq("id", paymentRow.booking_id)
    .maybeSingle();

  if (!booking || booking.member_id !== auth.session.memberId) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  try {
    const result = await confirmPortOneBookingPayment(paymentId);
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, message: "결제가 아직 확인되지 않았습니다. 잠시 후 다시 시도해 주세요." },
        { status: 202 },
      );
    }

    return NextResponse.json({
      ok: true,
      alreadyProcessed: result.alreadyProcessed ?? false,
      bookingId: result.bookingId ?? booking.id,
      bookingNumber: booking.booking_number ?? null,
      paymentKind: result.paymentKind,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "결제 확정에 실패했습니다.";
    console.error("[portone complete]", message);
    if (message === "PAYMENT_AMOUNT_MISMATCH") {
      return NextResponse.json({ message: "결제 금액이 일치하지 않습니다." }, { status: 400 });
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}
