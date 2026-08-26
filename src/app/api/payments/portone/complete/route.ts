import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmPortOneBookingPayment } from "@/lib/payments/confirmPortOneBookingPayment";
import { getMemberSessionFromCookies } from "@/lib/memberSession";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const bodySchema = z.object({
  paymentId: z.string().min(1),
});

/**
 * PortOne V2 브라우저 결제 직후 서버 확정.
 * - 회원 예약: 본인 세션만 허용
 * - 비회원 예약(member_id null): paymentId로 PortOne 검증 후 확정 (로그인 불필요)
 * Webhook과 동일 confirm 함수를 쓰므로 멱등.
 */
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = getMemberSessionFromCookies(cookieStore);

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

  if (!booking) {
    return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
  }

  const bookingMemberId =
    typeof booking.member_id === "string" && booking.member_id.trim()
      ? booking.member_id.trim()
      : null;

  if (bookingMemberId) {
    if (!session || session.memberId !== bookingMemberId) {
      return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
    }
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
