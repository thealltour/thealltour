import "server-only";

import {
  fetchPortOnePayment,
  isPortOnePaymentPaid,
  readPortOnePaymentAmount,
} from "@/lib/payments/portone/client";
import { reserveBookingPoints } from "@/lib/payments/reserveBookingPoints";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CheckoutSnapshot } from "@/types/checkout";

export type ConfirmPortOnePaymentResult = {
  ok: boolean;
  alreadyProcessed?: boolean;
  bookingId?: string;
};

export async function confirmPortOneBookingPayment(
  externalPaymentId: string,
): Promise<ConfirmPortOnePaymentResult> {
  const paymentId = externalPaymentId.trim();
  if (!paymentId) return { ok: false };

  const { data: paymentRow } = await supabaseAdmin
    .from("booking_payments")
    .select("id, booking_id, amount, status, payment_kind, external_payment_id")
    .eq("external_payment_id", paymentId)
    .maybeSingle();

  if (!paymentRow) return { ok: false };

  if (paymentRow.status === "confirmed") {
    return {
      ok: true,
      alreadyProcessed: true,
      bookingId: String(paymentRow.booking_id),
    };
  }

  const portonePayment = await fetchPortOnePayment(paymentId);
  if (!portonePayment || !isPortOnePaymentPaid(portonePayment)) {
    return { ok: false };
  }

  const paidAmount = readPortOnePaymentAmount(portonePayment);
  const expectedAmount = Number(paymentRow.amount);
  if (paidAmount != null && paidAmount !== expectedAmount) {
    throw new Error("PAYMENT_AMOUNT_MISMATCH");
  }

  const bookingId = String(paymentRow.booking_id);

  const { data: booking } = await supabaseAdmin
    .from("travel_bookings")
    .select(
      "id, booking_status, payment_status, payment_paid_amount, payment_total_amount, member_id, checkout_snapshot, departure_date",
    )
    .eq("id", bookingId)
    .maybeSingle();

  if (!booking) return { ok: false };

  const now = new Date().toISOString();
  const snapshot = booking.checkout_snapshot as CheckoutSnapshot | null;
  const memberId = typeof booking.member_id === "string" ? booking.member_id : null;

  await supabaseAdmin
    .from("booking_payments")
    .update({ status: "confirmed", recorded_at: now })
    .eq("id", paymentRow.id);

  const departureYmd =
    snapshot?.departure?.ymd ??
    (typeof booking.departure_date === "string" ? booking.departure_date : null);

  const returnDate = departureYmd ?? undefined;

  await supabaseAdmin
    .from("travel_bookings")
    .update({
      booking_status: "reserved",
      payment_status: "paid",
      payment_method: "portone",
      payment_paid_amount: expectedAmount,
      payment_confirmed_at: now,
      payment_external_id: paymentId,
      departure_date: departureYmd,
      return_date: returnDate,
      updated_at: now,
    })
    .eq("id", bookingId);

  if (memberId && snapshot?.pointsUseRequested && snapshot.pointsUseRequested > 0) {
    await reserveBookingPoints({
      memberId,
      bookingId,
      amount: snapshot.pointsUseRequested,
      refType: "BOOKING_DEPOSIT",
    });
  }

  if (memberId && snapshot?.couponPackId && (snapshot.paxDiscountAmount ?? 0) > 0) {
    const { redeemCouponForBooking } = await import(
      "@/server/services/coupons/redeemCouponForBooking"
    );
    await redeemCouponForBooking({
      userId: memberId,
      bookingId,
      packId: snapshot.couponPackId,
    });
  }

  return { ok: true, bookingId };
}
