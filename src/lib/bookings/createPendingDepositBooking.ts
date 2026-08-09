import "server-only";

import { randomUUID } from "crypto";
import { resolveCustomerProfileForMember } from "@/lib/bookings/searchBookingCustomers";
import { memberHasConfirmedBooking } from "@/lib/bookings/memberHasConfirmedBooking";
import {
  buildCheckoutQuote,
  validateCheckoutQuote,
  type CheckoutDepartureInput,
} from "@/lib/payments/buildCheckoutQuote";
import { findDepartureScheduleForYmd } from "@/lib/products/matchDepartureScheduleByYmd";
import { normalizeProductDepartureDateToYmd } from "@/lib/products/productDepartureDates";
import { validateInquiryPointsUse } from "@/lib/inquiry/inquiryPointsUse";
import { isPortOneEnabled } from "@/lib/payments/portone/config";
import { recommendCouponPackTier } from "@/lib/coupons/couponPacks";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { fetchMemberPoints } from "@/server/services/rewards/memberPoints";
import {
  findAvailableCouponPack,
  reserveCouponForBooking,
} from "@/server/services/coupons/reserveCouponForBooking";
import { releaseCouponReservation } from "@/server/services/coupons/releaseCouponReservation";
import type { CheckoutSnapshot } from "@/types/checkout";
import type { ProductOptions, SelectedOptions } from "@/types/product";
import type { CheckoutBenefitMode } from "@/lib/payments/resolveCheckoutBenefitMode";
import { isGolfCouponBenefitMode } from "@/lib/payments/resolveCheckoutBenefitMode";

export type CreatePendingDepositBookingInput = {
  memberId: string;
  productId: string;
  productTitle: string;
  sourcePath: string;
  departure: CheckoutDepartureInput & { ymd?: string | null };
  selectedOptions: SelectedOptions;
  options?: ProductOptions | null;
  productBasePrice?: number | null;
  pointsUse?: number;
  travelerCount?: number;
  returnDate?: string | null;
  /** 미전달 시 package_points (쿠폰 미적용) — prepare에서 반드시 판정 */
  benefitMode?: CheckoutBenefitMode;
};

export type CreatePendingDepositBookingResult = {
  booking_id: string;
  booking_number: string;
  payment_id: string;
  external_payment_id: string;
  checkout_snapshot: CheckoutSnapshot;
  portone: {
    storeId: string;
    channelKey: string;
    paymentId: string;
    orderName: string;
    totalAmount: number;
    currency: "CURRENCY_KRW";
  };
};

function parseDepartureYmd(departure: CheckoutDepartureInput): string | null {
  if (departure.ymd?.trim()) return departure.ymd.trim();
  return normalizeProductDepartureDateToYmd(departure.inquiryValue);
}

export async function createPendingDepositBooking(
  input: CreatePendingDepositBookingInput,
): Promise<CreatePendingDepositBookingResult> {
  if (!isPortOneEnabled()) {
    throw new Error("PORTONE_NOT_CONFIGURED");
  }
  const storeId = process.env.PORTONE_STORE_ID?.trim();
  const channelKey = process.env.PORTONE_CHANNEL_KEY?.trim();
  if (!storeId || !channelKey) {
    throw new Error("PORTONE_NOT_CONFIGURED");
  }

  const customer = await resolveCustomerProfileForMember(input.memberId);
  const benefitMode: CheckoutBenefitMode = input.benefitMode ?? "package_points";
  const isGolfCoupon = isGolfCouponBenefitMode(benefitMode);

  const [{ balance: pointBalance }, hasPreviousBooking] = await Promise.all([
    fetchMemberPoints(supabaseAdmin, input.memberId),
    memberHasConfirmedBooking(input.memberId),
  ]);

  const pointsUse = isGolfCoupon ? 0 : input.pointsUse;
  const preferredTier = recommendCouponPackTier(hasPreviousBooking);

  const availablePack = isGolfCoupon
    ? await findAvailableCouponPack({
        userId: input.memberId,
        preferredTier,
      })
    : null;

  const applyPaxDiscount = Boolean(isGolfCoupon && availablePack);
  const couponPackInput = availablePack
    ? { tier: availablePack.tier, unitAmount: availablePack.unit_amount }
    : null;

  let checkoutQuote = buildCheckoutQuote({
    options: input.options,
    selectedOptions: input.selectedOptions,
    departure: input.departure,
    productBasePrice: input.productBasePrice,
    pointsUse,
    travelerCount: input.travelerCount,
    applyPaxDiscount,
    hasPreviousBooking,
    couponPack: couponPackInput,
  });

  const quoteValidation = validateCheckoutQuote(checkoutQuote);
  if (!quoteValidation.ok) {
    throw new Error(quoteValidation.message);
  }

  if (!isGolfCoupon) {
    const pointsValidation = validateInquiryPointsUse({
      pointsUseRequested: checkoutQuote.pointsApplied,
      pointBalance,
    });
    if (!pointsValidation.ok) {
      throw new Error(pointsValidation.message);
    }
  }

  const departureYmd = parseDepartureYmd(input.departure);
  if (!departureYmd) {
    throw new Error("출발일 형식이 올바르지 않습니다.");
  }

  const returnDate = input.returnDate?.trim() || departureYmd;

  const { data: bookingNumberData, error: bookingNumberError } = await supabaseAdmin.rpc(
    "generate_booking_number",
  );
  if (bookingNumberError || !bookingNumberData) {
    throw new Error("예약번호 생성에 실패했습니다.");
  }

  const bookingNumber = String(bookingNumberData);
  const externalPaymentId = `dep-${randomUUID()}`;

  let couponPackId: string | null = availablePack?.id ?? null;

  const buildSnapshot = (): CheckoutSnapshot => ({
    productId: input.productId,
    productTitle: input.productTitle,
    sourcePath: input.sourcePath,
    departure: {
      label: input.departure.label,
      inquiryValue: input.departure.inquiryValue,
      ymd: departureYmd,
      price: input.departure.price ?? null,
    },
    selectedOptions: input.selectedOptions,
    quoteBreakdown: checkoutQuote.breakdown,
    quoteTotal: checkoutQuote.quoteTotal,
    pointsUseRequested: checkoutQuote.pointsApplied,
    paxDiscountAmount: checkoutQuote.paxDiscountAmount,
    discountTier: checkoutQuote.discountTier,
    discountLabel: checkoutQuote.discountLabel,
    benefitMode,
    isGolfProduct: isGolfCoupon,
    couponPackId,
    depositAmount: checkoutQuote.depositAmount,
    balanceDue: checkoutQuote.balanceDue,
    travelerCount: checkoutQuote.travelerCount,
    preparedAt: new Date().toISOString(),
  });

  let checkoutSnapshot = buildSnapshot();

  const { data: bookingRow, error: bookingError } = await supabaseAdmin
    .from("travel_bookings")
    .insert({
      customer_profile_id: customer.customer_profile_id,
      member_id: input.memberId,
      product_id: input.productId,
      product_title: input.productTitle,
      source_path: input.sourcePath,
      booking_status: "pending_deposit",
      departure_date: departureYmd,
      return_date: returnDate,
      booking_number: bookingNumber,
      traveler_count: checkoutQuote.travelerCount,
      payer_name: customer.name,
      primary_traveler_phone: customer.phone,
      payment_status: "unpaid",
      payment_total_amount: checkoutQuote.quoteTotal,
      payment_paid_amount: 0,
      checkout_snapshot: checkoutSnapshot,
    })
    .select("id")
    .single();

  if (bookingError || !bookingRow) {
    throw new Error(bookingError?.message || "예약 생성에 실패했습니다.");
  }

  const bookingId = String(bookingRow.id);

  if (availablePack && checkoutQuote.paxDiscountAmount > 0) {
    const reserved = await reserveCouponForBooking({
      userId: input.memberId,
      bookingId,
      packId: availablePack.id,
      discountAmount: checkoutQuote.paxDiscountAmount,
      travelerCount: checkoutQuote.travelerCount,
    });

    if (!reserved.ok) {
      // 레이스: 할인 없이 재계산
      couponPackId = null;
      checkoutQuote = buildCheckoutQuote({
        options: input.options,
        selectedOptions: input.selectedOptions,
        departure: input.departure,
        productBasePrice: input.productBasePrice,
        pointsUse,
        travelerCount: input.travelerCount,
        applyPaxDiscount: false,
        hasPreviousBooking,
        couponPack: null,
      });
      checkoutSnapshot = buildSnapshot();
      await supabaseAdmin
        .from("travel_bookings")
        .update({
          checkout_snapshot: checkoutSnapshot,
          payment_total_amount: checkoutQuote.quoteTotal,
          traveler_count: checkoutQuote.travelerCount,
        })
        .eq("id", bookingId);
    } else {
      couponPackId = reserved.pack.id;
      checkoutSnapshot = buildSnapshot();
      await supabaseAdmin
        .from("travel_bookings")
        .update({ checkout_snapshot: checkoutSnapshot })
        .eq("id", bookingId);
    }
  }

  const { data: paymentRow, error: paymentError } = await supabaseAdmin
    .from("booking_payments")
    .insert({
      booking_id: bookingId,
      amount: checkoutQuote.depositAmount,
      method: "portone",
      status: "pending",
      external_provider: "portone",
      external_payment_id: externalPaymentId,
      payment_kind: "deposit",
    })
    .select("id")
    .single();

  if (paymentError || !paymentRow) {
    if (couponPackId) {
      await releaseCouponReservation({
        userId: input.memberId,
        bookingId,
        packId: couponPackId,
      }).catch(() => undefined);
    }
    await supabaseAdmin.from("travel_bookings").delete().eq("id", bookingId);
    throw new Error(paymentError?.message || "결제 준비에 실패했습니다.");
  }

  return {
    booking_id: bookingId,
    booking_number: bookingNumber,
    payment_id: String(paymentRow.id),
    external_payment_id: externalPaymentId,
    checkout_snapshot: checkoutSnapshot,
    portone: {
      storeId,
      channelKey,
      paymentId: externalPaymentId,
      orderName: `${input.productTitle} 예약금`.slice(0, 80),
      totalAmount: checkoutQuote.depositAmount,
      currency: "CURRENCY_KRW",
    },
  };
}

export function resolveReturnDateFromProduct(params: {
  departureYmd: string;
  schedules?: { departureDate: string; returnDate?: string | null }[];
}): string {
  const schedule = findDepartureScheduleForYmd(params.schedules, params.departureYmd);
  const returnRaw = schedule?.returnDate?.trim();
  const returnYmd = returnRaw ? normalizeProductDepartureDateToYmd(returnRaw) : null;
  return returnYmd ?? params.departureYmd;
}
