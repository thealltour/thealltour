import type { CheckoutPaymentType } from "@/lib/payments/bookingPaymentPayload";

export type CheckoutPayAmounts = {
  paymentType: CheckoutPaymentType;
  totalTripPrice: number;
  /** 예약금 합계 (인당 × 인원) */
  depositTotal: number;
  payAmount: number;
  remainingBalance: number;
};

/**
 * 예약금/전액에 따른 오늘 결제액·잔금.
 * totalTripPrice·depositTotal은 이미 인원 반영된 합계.
 */
export function resolveCheckoutPayAmounts(input: {
  paymentType: CheckoutPaymentType;
  totalTripPrice: number;
  depositTotal: number;
}): CheckoutPayAmounts {
  const totalTripPrice = Math.max(0, Math.floor(input.totalTripPrice));
  const depositTotal = Math.max(0, Math.floor(input.depositTotal));
  const cappedDeposit = Math.min(depositTotal, totalTripPrice);

  if (input.paymentType === "full") {
    return {
      paymentType: "full",
      totalTripPrice,
      depositTotal: cappedDeposit,
      payAmount: totalTripPrice,
      remainingBalance: 0,
    };
  }

  return {
    paymentType: "deposit",
    totalTripPrice,
    depositTotal: cappedDeposit,
    payAmount: cappedDeposit,
    remainingBalance: Math.max(0, totalTripPrice - cappedDeposit),
  };
}
