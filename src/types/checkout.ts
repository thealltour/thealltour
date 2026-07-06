import type { QuoteBreakdownItem } from "@/lib/pricing/calcQuote";
import type { SelectedOptions } from "@/types/product";

export type CheckoutSnapshot = {
  productId: string;
  productTitle: string;
  sourcePath: string;
  departure: {
    label: string;
    inquiryValue: string;
    ymd: string | null;
    price: number | null;
  };
  selectedOptions: SelectedOptions;
  quoteBreakdown: QuoteBreakdownItem[];
  quoteTotal: number;
  pointsUseRequested: number;
  depositAmount: number;
  balanceDue: number;
  travelerCount: number;
  preparedAt: string;
};

export type BalancePaymentPreference = "cash_receipt" | "portone";

export const BOOKING_DEPOSIT_REF_TYPE = "BOOKING_DEPOSIT" as const;
export const BOOKING_BALANCE_REF_TYPE = "BOOKING_BALANCE" as const;
