import type { QuoteResult } from "@/lib/pricing/calcQuote";
import type { SelectedOptions } from "@/types/product";

export type SelectedDeparture = {
  label: string;
  inquiryValue: string;
  price?: number | null;
};

export type BuildProductInquiryPrefillParams = {
  productTitle?: string | null;
  selectedDeparture?: SelectedDeparture | null;
  travelerCount?: number | null;
  quoteSummary?: QuoteResult | null;
  selectedOptions?: SelectedOptions | null;
};

/**
 * 빠른 문의 prefill / 카톡 클립보드용 상품 문의 요약 텍스트
 */
export function buildProductInquiryPrefill(params: BuildProductInquiryPrefillParams): string {
  const lines: string[] = [];

  const title = params.productTitle?.trim();
  if (title) {
    lines.push(`상품: ${title}`);
  }

  const departure = params.selectedDeparture;
  if (departure?.inquiryValue) {
    lines.push(`희망 출발일: ${departure.inquiryValue}`);
    if (departure.price != null && departure.price > 0) {
      lines.push(`선택 요금: ${departure.price.toLocaleString("ko-KR")}원`);
    }
  }

  const travelerCount =
    typeof params.travelerCount === "number" && Number.isFinite(params.travelerCount)
      ? Math.round(params.travelerCount)
      : null;
  if (travelerCount != null && travelerCount > 0) {
    lines.push(`인원: ${travelerCount}명`);
  }

  const breakdown = params.quoteSummary?.breakdown ?? [];
  if (breakdown.length > 0) {
    lines.push("선택 옵션:");
    for (const item of breakdown) {
      const delta =
        item.priceDelta !== 0
          ? ` (${item.priceDelta >= 0 ? "+" : ""}${item.priceDelta.toLocaleString("ko-KR")}원)`
          : "";
      lines.push(`- ${item.groupLabel}: ${item.optionLabel}${delta}`);
    }
  } else if (params.selectedOptions && Object.keys(params.selectedOptions).length > 0) {
    lines.push("선택 옵션:");
    for (const [groupKey, value] of Object.entries(params.selectedOptions)) {
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item) lines.push(`- ${groupKey}: ${item}`);
        }
      } else if (value) {
        lines.push(`- ${groupKey}: ${value}`);
      }
    }
  }

  if (params.quoteSummary?.total != null && params.quoteSummary.total > 0) {
    lines.push(`예상 견적: ${params.quoteSummary.total.toLocaleString("ko-KR")}원`);
  }

  return lines.join("\n");
}
