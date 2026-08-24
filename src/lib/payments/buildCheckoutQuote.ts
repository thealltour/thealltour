import { calcQuote, type QuoteBreakdownItem } from "@/lib/pricing/calcQuote";
import { normalizePointsUseRequested } from "@/lib/inquiry/inquiryPointsUse";
import {
  calculatePaxDiscount,
  calculatePaxDiscountFromPack,
  capPaxDiscountAmount,
  type DiscountTier,
} from "@/lib/payments/calculatePaxDiscount";
import type { ProductOptions, SelectedOptions } from "@/types/product";

/** 인당 예약금 (원). 총 예약금 = 인당 × 인원 */
export const CHECKOUT_DEPOSIT_PER_PERSON = 100_000;

/** @deprecated 이름 호환 — 인당 예약금과 동일 */
export const CHECKOUT_DEPOSIT_AMOUNT = CHECKOUT_DEPOSIT_PER_PERSON;

export type CheckoutDepartureInput = {
  label: string;
  inquiryValue: string;
  ymd?: string | null;
  price?: number | null;
};

export type CheckoutQuoteInput = {
  options?: ProductOptions | null;
  selectedOptions: SelectedOptions;
  departure?: CheckoutDepartureInput | null;
  productBasePrice?: number | null;
  pointsUse?: number | unknown;
  travelerCount?: number;
  /** true일 때만 인원×단가 프로모션 할인 적용 (로그인 회원) */
  applyPaxDiscount?: boolean;
  /** reserved|completed 예약 이력이 있으면 RETURNING 티어 (팩 없을 때 미리보기용) */
  hasPreviousBooking?: boolean;
  /** 보유 쿠폰팩이 있으면 단가·티어의 진실 소스 */
  couponPack?: { tier: DiscountTier; unitAmount: number } | null;
  /** 인당 예약금 오버라이드 (기본 CHECKOUT_DEPOSIT_PER_PERSON) */
  depositPerPerson?: number;
};

export type CheckoutQuoteResult = {
  quoteTotal: number;
  optionDelta: number;
  departurePrice: number | null;
  baseComponent: number;
  pointsApplied: number;
  paxDiscountAmount: number;
  discountLabel: string | null;
  discountTier: DiscountTier | null;
  /** 인당 예약금 */
  depositPerPerson: number;
  /** 총 예약금 = 인당 × 인원 */
  depositAmount: number;
  balanceDue: number;
  breakdown: QuoteBreakdownItem[];
  travelerCount: number;
};

export function buildCheckoutQuote(input: CheckoutQuoteInput): CheckoutQuoteResult {
  const travelerCount = Math.max(1, Math.floor(input.travelerCount ?? 1));
  const depositPerPerson = Math.max(
    0,
    Math.floor(input.depositPerPerson ?? CHECKOUT_DEPOSIT_PER_PERSON),
  );
  const depositAmount = depositPerPerson * travelerCount;
  const pointsApplied = normalizePointsUseRequested(input.pointsUse);
  const quote = calcQuote(input.options ?? undefined, input.selectedOptions);

  const optionDelta =
    quote.total != null && quote.basePrice != null
      ? quote.total - quote.basePrice
      : quote.breakdown.reduce((sum, item) => sum + item.priceDelta, 0);

  const departurePrice =
    typeof input.departure?.price === "number" && input.departure.price > 0
      ? input.departure.price
      : null;

  const baseComponent =
    departurePrice ??
    quote.basePrice ??
    (typeof input.productBasePrice === "number" && input.productBasePrice > 0
      ? input.productBasePrice
      : 0);

  const perPersonTotal = baseComponent + optionDelta;
  const quoteTotal = Math.max(0, perPersonTotal * travelerCount);

  let paxDiscountAmount = 0;
  let discountLabel: string | null = null;
  let discountTier: DiscountTier | null = null;

  if (input.applyPaxDiscount) {
    const pax = input.couponPack
      ? calculatePaxDiscountFromPack({
          travelerCount,
          tier: input.couponPack.tier,
          unitAmount: input.couponPack.unitAmount,
        })
      : calculatePaxDiscount({
          travelerCount,
          hasPreviousBooking: Boolean(input.hasPreviousBooking),
        });
    paxDiscountAmount = capPaxDiscountAmount({
      quoteTotal,
      rawPaxDiscount: pax.totalDiscount,
      depositAmount,
    });
    discountLabel = pax.label;
    discountTier = pax.tier;
  }

  const afterPromo = Math.max(0, quoteTotal - paxDiscountAmount);
  const afterPoints = Math.max(0, afterPromo - pointsApplied);
  const balanceDue = Math.max(0, afterPoints - depositAmount);

  return {
    quoteTotal,
    optionDelta,
    departurePrice,
    baseComponent,
    pointsApplied,
    paxDiscountAmount,
    discountLabel,
    discountTier,
    depositPerPerson,
    depositAmount,
    balanceDue,
    breakdown: quote.breakdown,
    travelerCount,
  };
}

export function validateCheckoutQuote(quote: CheckoutQuoteResult): { ok: true } | { ok: false; message: string } {
  if (quote.quoteTotal <= 0) {
    return { ok: false, message: "견적 금액을 계산할 수 없습니다. 출발일·옵션을 확인해 주세요." };
  }
  if (quote.paxDiscountAmount < 0 || quote.pointsApplied < 0) {
    return { ok: false, message: "할인 금액이 올바르지 않습니다." };
  }
  if (quote.paxDiscountAmount + quote.pointsApplied > quote.quoteTotal) {
    return { ok: false, message: "할인·포인트 합계가 견적 합계를 초과합니다." };
  }
  if (quote.depositAmount > quote.quoteTotal - quote.paxDiscountAmount - quote.pointsApplied) {
    return { ok: false, message: "예약금이 결제 가능 금액보다 큽니다. 상담 문의로 예약해 주세요." };
  }
  return { ok: true };
}
