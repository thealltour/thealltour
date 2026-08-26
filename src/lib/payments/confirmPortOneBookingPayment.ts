import "server-only";

import { randomUUID } from "crypto";
import {
  fetchPortOnePayment,
  isPortOnePaymentPaid,
  readPortOnePaymentAmount,
} from "@/lib/payments/portone/client";
import { isPortOneEnabled } from "@/lib/payments/portone/config";
import { reserveBookingPoints } from "@/lib/payments/reserveBookingPoints";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { CheckoutSnapshot } from "@/types/checkout";

export type ConfirmPortOnePaymentResult = {
  ok: boolean;
  alreadyProcessed?: boolean;
  bookingId?: string;
  paymentKind?: "deposit" | "balance";
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
      paymentKind: (paymentRow.payment_kind as "deposit" | "balance") ?? undefined,
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
  const paymentKind = (paymentRow.payment_kind as "deposit" | "balance" | null) ?? "deposit";

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

  if (paymentKind === "deposit") {
    const departureYmd =
      snapshot?.departure?.ymd ??
      (typeof booking.departure_date === "string" ? booking.departure_date : null);

    const returnDate = departureYmd ?? undefined;

    await supabaseAdmin
      .from("travel_bookings")
      .update({
        booking_status: "reserved",
        payment_status: (snapshot?.balanceDue ?? 0) <= 0 ? "paid" : "partial",
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
  } else {
    const prevPaid = Number(booking.payment_paid_amount ?? 0);
    const totalPaid = prevPaid + expectedAmount;
    const totalAmount = Number(booking.payment_total_amount ?? totalPaid);
    const paymentStatus = totalPaid >= totalAmount ? "paid" : "partial";

    await supabaseAdmin
      .from("travel_bookings")
      .update({
        payment_status: paymentStatus,
        payment_method: "portone",
        payment_paid_amount: totalPaid,
        payment_confirmed_at: now,
        payment_external_id: paymentId,
        updated_at: now,
      })
      .eq("id", bookingId);

    if (memberId && snapshot?.pointsUseRequested && snapshot.pointsUseRequested > 0) {
      await confirmBookingPointsUse({
        memberId,
        bookingId,
        amount: snapshot.pointsUseRequested,
      });
    }
  }

  return { ok: true, bookingId, paymentKind };
}

async function confirmBookingPointsUse(params: {
  memberId: string;
  bookingId: string;
  amount: number;
}): Promise<void> {
  const { confirmReservedBookingPoints } = await import("@/lib/payments/reserveBookingPoints");
  await confirmReservedBookingPoints(params);
}

export async function prepareBalancePortOnePayment(params: {
  bookingId: string;
  memberId: string;
  amount: number;
}): Promise<{ external_payment_id: string; portone: Record<string, unknown> }> {
  if (!isPortOneEnabled()) {
    throw new Error("PORTONE_NOT_CONFIGURED");
  }
  const storeId = process.env.PORTONE_STORE_ID?.trim();
  const channelKey = process.env.PORTONE_CHANNEL_KEY?.trim();
  if (!storeId || !channelKey) {
    throw new Error("PORTONE_NOT_CONFIGURED");
  }

  const { data: booking } = await supabaseAdmin
    .from("travel_bookings")
    .select("id, product_title, checkout_snapshot, payment_status, booking_status")
    .eq("id", params.bookingId)
    .eq("member_id", params.memberId)
    .maybeSingle();

  if (!booking) throw new Error("예약을 찾을 수 없습니다.");
  if (booking.booking_status === "canceled") throw new Error("취소된 예약입니다.");
  if (booking.payment_status === "paid") throw new Error("이미 결제가 완료되었습니다.");

  const externalPaymentId = `bal-${randomUUID()}`;
  const snapshot = booking.checkout_snapshot as CheckoutSnapshot | null;
  const productTitle = snapshot?.productTitle ?? String(booking.product_title ?? "여행");

  const { error } = await supabaseAdmin.from("booking_payments").insert({
    booking_id: params.bookingId,
    amount: params.amount,
    method: "portone",
    status: "pending",
    external_provider: "portone",
    external_payment_id: externalPaymentId,
    payment_kind: "balance",
  });

  if (error) throw new Error(error.message);

  return {
    external_payment_id: externalPaymentId,
    portone: {
      storeId,
      channelKey,
      paymentId: externalPaymentId,
      orderName: `${productTitle} 잔금`.slice(0, 80),
      totalAmount: params.amount,
      currency: "CURRENCY_KRW",
    },
  };
}

export async function saveCashReceiptBalancePreference(params: {
  bookingId: string;
  memberId: string;
}): Promise<void> {
  const { data: booking } = await supabaseAdmin
    .from("travel_bookings")
    .select("id, checkout_snapshot, payment_status")
    .eq("id", params.bookingId)
    .eq("member_id", params.memberId)
    .maybeSingle();

  if (!booking) throw new Error("예약을 찾을 수 없습니다.");
  if (booking.payment_status === "paid") throw new Error("이미 결제가 완료되었습니다.");

  await supabaseAdmin
    .from("travel_bookings")
    .update({
      balance_payment_preference: "cash_receipt",
      cash_receipt_requested: true,
      local_perks_matched: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.bookingId);
}
