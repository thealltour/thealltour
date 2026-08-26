import "server-only";

import { randomUUID } from "crypto";
import { memberHasConfirmedBooking } from "@/lib/bookings/memberHasConfirmedBooking";
import { linkMemberToCustomerProfile } from "@/lib/customerAccountLinks";
import { findOrCreateCustomerProfile } from "@/lib/customerProfiles";
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

export type CheckoutCustomerInput = {
  name: string;
  phone: string;
  email: string;
};

export type CreatePendingDepositBookingInput = {
  /** 로그인 회원. 비회원이면 null/미전달 */
  memberId?: string | null;
  /** 주문서에 입력된 예약자 정보 (회원 프로필이 비어 있어도 이 값을 우선) */
  customer: CheckoutCustomerInput;
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
  /** deposit=예약금, full=전액. 기본 deposit */
  paymentType?: "deposit" | "full";
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
  const candidates = [departure.ymd, departure.inquiryValue, departure.label];
  for (const raw of candidates) {
    const normalized = normalizeProductDepartureDateToYmd(raw);
    if (normalized) return normalized;
  }
  return null;
}

async function resolveCheckoutCustomer(input: {
  memberId?: string | null;
  customer: CheckoutCustomerInput;
}) {
  const name = input.customer.name.trim();
  const phone = input.customer.phone.trim();
  const email = input.customer.email.trim();
  if (!name || !phone) {
    throw new Error("예약자 이름과 연락처를 입력해 주세요.");
  }

  const profile = await findOrCreateCustomerProfile({
    name,
    phone,
    email: email || undefined,
    source: "inquiry",
  });
  if (!profile) {
    throw new Error("고객 정보를 저장할 수 없습니다. 연락처를 확인해 주세요.");
  }

  /** 세션 memberId가 members 테이블에 없으면 FK 위반 → null 처리(게스트 예약) */
  let memberId: string | null = null;
  const candidateId = input.memberId?.trim() || null;
  if (candidateId) {
    const { data: memberRow, error: memberLookupError } = await supabaseAdmin
      .from("members")
      .select("id")
      .eq("id", candidateId)
      .maybeSingle();
    if (memberLookupError) {
      console.warn(
        "[createPendingDepositBooking] member lookup failed; booking as guest",
        candidateId,
        memberLookupError.message,
      );
    } else if (memberRow?.id) {
      memberId = String(memberRow.id);
      await linkMemberToCustomerProfile(memberId, profile.id, {
        linked_by: "self",
        verified_method: "manual",
      }).catch(() => null);
    } else {
      console.warn(
        "[createPendingDepositBooking] session memberId not found in members; booking as guest",
        candidateId,
      );
    }
  }

  return {
    customer_profile_id: profile.id,
    member_id: memberId,
    name: name || profile.name,
    phone: phone || profile.phone,
    email: email || profile.email || "",
  };
}

export async function createPendingDepositBooking(
  input: CreatePendingDepositBookingInput,
): Promise<CreatePendingDepositBookingResult> {
  if (!isPortOneEnabled()) {
    throw new Error("PORTONE_NOT_CONFIGURED");
  }
  const storeId =
    process.env.PORTONE_STORE_ID?.trim() ||
    process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim();
  const channelKey =
    process.env.PORTONE_CHANNEL_KEY?.trim() ||
    process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY?.trim();
  if (!storeId || !channelKey) {
    throw new Error("PORTONE_NOT_CONFIGURED");
  }

  const customer = await resolveCheckoutCustomer({
    memberId: input.memberId,
    customer: input.customer,
  });
  const memberId = customer.member_id;
  const benefitMode: CheckoutBenefitMode = input.benefitMode ?? "package_points";
  const isGolfCoupon = isGolfCouponBenefitMode(benefitMode);

  const [pointBalance, hasPreviousBooking] = memberId
    ? await Promise.all([
        fetchMemberPoints(supabaseAdmin, memberId).then((r) => r.balance),
        memberHasConfirmedBooking(memberId),
      ])
    : [0, false];

  const pointsUse = isGolfCoupon || !memberId ? 0 : input.pointsUse;
  const preferredTier = recommendCouponPackTier(hasPreviousBooking);

  const availablePack =
    isGolfCoupon && memberId
      ? await findAvailableCouponPack({
          userId: memberId,
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

  const returnDate =
    normalizeProductDepartureDateToYmd(input.returnDate) || departureYmd;

  const { data: bookingNumberData, error: bookingNumberError } = await supabaseAdmin.rpc(
    "generate_booking_number",
  );
  if (bookingNumberError || !bookingNumberData) {
    throw new Error("예약번호 생성에 실패했습니다.");
  }

  const bookingNumber = String(bookingNumberData);
  const paymentType = input.paymentType === "full" ? "full" : "deposit";
  const externalPaymentId = `${paymentType === "full" ? "full" : "dep"}-${randomUUID()}`;

  let couponPackId: string | null = availablePack?.id ?? null;

  const resolvePayAmounts = () => {
    const payNowAmount =
      paymentType === "full" ? checkoutQuote.quoteTotal : checkoutQuote.depositAmount;
    const balanceDue = paymentType === "full" ? 0 : checkoutQuote.balanceDue;
    return { payNowAmount, balanceDue };
  };

  const buildSnapshot = (): CheckoutSnapshot => {
    const { payNowAmount, balanceDue } = resolvePayAmounts();
    return {
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
      depositAmount: paymentType === "full" ? payNowAmount : checkoutQuote.depositAmount,
      balanceDue,
      travelerCount: checkoutQuote.travelerCount,
      preparedAt: new Date().toISOString(),
    };
  };

  let checkoutSnapshot = buildSnapshot();

  const { data: bookingRow, error: bookingError } = await supabaseAdmin
    .from("travel_bookings")
    .insert({
      customer_profile_id: customer.customer_profile_id,
      member_id: memberId,
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

  if (memberId && availablePack && checkoutQuote.paxDiscountAmount > 0) {
    const reserved = await reserveCouponForBooking({
      userId: memberId,
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

  const { payNowAmount } = resolvePayAmounts();

  const { data: paymentRow, error: paymentError } = await supabaseAdmin
    .from("booking_payments")
    .insert({
      booking_id: bookingId,
      amount: payNowAmount,
      method: "portone",
      status: "pending",
      external_provider: "portone",
      external_payment_id: externalPaymentId,
      payment_kind: "deposit",
    })
    .select("id")
    .single();

  if (paymentError || !paymentRow) {
    if (memberId && couponPackId) {
      await releaseCouponReservation({
        userId: memberId,
        bookingId,
        packId: couponPackId,
      }).catch(() => undefined);
    }
    await supabaseAdmin.from("travel_bookings").delete().eq("id", bookingId);
    throw new Error(paymentError?.message || "결제 준비에 실패했습니다.");
  }

  const typeLabel = paymentType === "full" ? "전액결제" : "예약금";
  const orderName = `${input.productTitle} (${typeLabel})`.slice(0, 80);

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
      orderName,
      totalAmount: payNowAmount,
      currency: "CURRENCY_KRW" as const,
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
