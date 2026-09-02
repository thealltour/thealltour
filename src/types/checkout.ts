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
  paxDiscountAmount?: number;
  discountTier?: string | null;
  discountLabel?: string | null;
  benefitMode?: "golf_coupon" | "package_points";
  isGolfProduct?: boolean;
  couponPackId?: string | null;
  depositAmount: number;
  balanceDue: number;
  travelerCount: number;
  preparedAt: string;
};

export const BOOKING_DEPOSIT_REF_TYPE = "BOOKING_DEPOSIT" as const;
