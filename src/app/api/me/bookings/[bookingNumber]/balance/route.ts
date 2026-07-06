import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMemberSession } from "@/lib/apiAuth";
import { findCustomerProfilesByMemberId } from "@/lib/customerAccountLinks";
import { isPortOneEnabled } from "@/lib/payments/portone/config";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function authorizeBooking(memberId: string, booking: Record<string, unknown>) {
  if (booking.member_id === memberId) return true;
  const profiles = await findCustomerProfilesByMemberId(memberId);
  const profileIds = new Set(profiles.map((p) => p.id));
  return typeof booking.customer_profile_id === "string" && profileIds.has(booking.customer_profile_id);
}

const balanceBodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("cash_receipt") }),
  z.object({ mode: z.literal("portone") }),
]);

export async function POST(
  request: Request,
  context: { params: Promise<{ bookingNumber: string }> },
) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const memberId = auth.session.memberId;
  const { bookingNumber: param } = await context.params;

  let body: z.infer<typeof balanceBodySchema>;
  try {
    body = balanceBodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ message: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  let query = supabaseAdmin.from("travel_bookings").select("*");
  query = UUID_RE.test(param)
    ? query.eq("id", param)
    : query.eq("booking_number", param.trim());

  const { data: booking } = await query.maybeSingle();
  if (!booking) {
    return NextResponse.json({ message: "예약을 찾을 수 없습니다." }, { status: 404 });
  }

  const row = booking as Record<string, unknown>;
  if (!(await authorizeBooking(memberId, row))) {
    return NextResponse.json({ message: "접근 권한이 없습니다." }, { status: 403 });
  }

  const bookingId = String(row.id);
  const snapshot = row.checkout_snapshot as { balanceDue?: number } | null;
  const balanceDue = Number(snapshot?.balanceDue ?? 0);

  try {
    const {
      saveCashReceiptBalancePreference,
      prepareBalancePortOnePayment,
    } = await import("@/lib/payments/confirmPortOneBookingPayment");

    if (body.mode === "cash_receipt") {
      await saveCashReceiptBalancePreference({ bookingId, memberId });
      return NextResponse.json({
        ok: true,
        mode: "cash_receipt",
        message: "현금 결제 + 현금영수증 발행이 선택되었습니다. 현지 특전이 자동 매칭됩니다.",
      });
    }

    if (balanceDue <= 0) {
      return NextResponse.json({ message: "잔금이 없습니다." }, { status: 400 });
    }

    if (!isPortOneEnabled()) {
      return NextResponse.json(
        { message: "온라인 잔금 결제가 일시 중단되었습니다. 현금+현금영수증을 선택해 주세요." },
        { status: 503 },
      );
    }

    const prepared = await prepareBalancePortOnePayment({
      bookingId,
      memberId,
      amount: balanceDue,
    });

    await supabaseAdmin
      .from("travel_bookings")
      .update({
        balance_payment_preference: "portone",
        updated_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    return NextResponse.json({
      ok: true,
      mode: "portone",
      external_payment_id: prepared.external_payment_id,
      portone: prepared.portone,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "잔금 결제 준비에 실패했습니다.";
    if (message === "PORTONE_NOT_CONFIGURED") {
      return NextResponse.json(
        { message: "온라인 잔금 결제가 아직 설정되지 않았습니다. 현금+현금영수증을 선택해 주세요." },
        { status: 503 },
      );
    }
    return NextResponse.json({ message }, { status: 400 });
  }
}
