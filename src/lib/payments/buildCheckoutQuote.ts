import { calcQuote, type QuoteBreakdownItem } from "@/lib/pricing/calcQuote";
import { normalizePointsUseRequested } from "@/lib/inquiry/inquiryPointsUse";
import type { ProductOptions, SelectedOptions } from "@/types/product";

export const CHECKOUT_DEPOSIT_AMOUNT = 100_000;

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
};

export type CheckoutQuoteResult = {
  quoteTotal: number;
  optionDelta: number;
  departurePrice: number | null;
  baseComponent: number;
  pointsApplied: number;
  depositAmount: number;
  balanceDue: number;
  breakdown: QuoteBreakdownItem[];
  travelerCount: number;
};

export function buildCheckoutQuote(input: CheckoutQuoteInput): CheckoutQuoteResult {
  const travelerCount = Math.max(1, Math.floor(input.travelerCount ?? 1));
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
  const afterPoints = Math.max(0, quoteTotal - pointsApplied);
  const balanceDue = Math.max(0, afterPoints - CHECKOUT_DEPOSIT_AMOUNT);

  return {
    quoteTotal,
    optionDelta,
    departurePrice,
    baseComponent,
    pointsApplied,
    depositAmount: CHECKOUT_DEPOSIT_AMOUNT,
    balanceDue,
    breakdown: quote.breakdown,
    travelerCount,
  };
}

export function validateCheckoutQuote(quote: CheckoutQuoteResult): { ok: true } | { ok: false; message: string } {
  if (quote.quoteTotal <= 0) {
    return { ok: false, message: "견적 금액을 계산할 수 없습니다. 출발일·옵션을 확인해 주세요." };
  }
  if (quote.pointsApplied > quote.quoteTotal) {
    return { ok: false, message: "포인트 사용액이 견적 합계를 초과합니다." };
  }
  if (quote.depositAmount > quote.quoteTotal - quote.pointsApplied) {
    return { ok: false, message: "예약금이 결제 가능 금액보다 큽니다. 상담 문의로 예약해 주세요." };
  }
  return { ok: true };
}
