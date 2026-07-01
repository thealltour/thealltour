"use client";

import { useProductQuote } from "@/components/products/ProductQuoteContext";
import { formatPriceKR } from "@/lib/pricing/calcQuote";

/**
 * Sticky CTA 영역용 출발일·옵션 선택 요약
 */
export function ProductBookingSelectionSummary({ className = "" }: { className?: string }) {
  const {
    selectedDeparture,
    quoteSummary,
    requiredGroupsMissing,
    departureRequired,
    departureSelectionMissing,
  } = useProductQuote();

  const hasDeparture = Boolean(selectedDeparture?.label);
  const optionLines = quoteSummary?.breakdown ?? [];
  const hasOptions = optionLines.length > 0;

  if (!departureRequired && !hasOptions && !requiredGroupsMissing) {
    return null;
  }

  return (
    <div
      className={`space-y-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-xs ${className}`.trim()}
      aria-label="선택한 출발일 및 옵션"
    >
      {departureRequired ? (
        hasDeparture ? (
          <p className="font-medium text-slate-800">
            <span className="text-slate-500">선택 출발일</span>
            {" · "}
            {selectedDeparture!.label}
            {selectedDeparture!.price != null && selectedDeparture!.price > 0 ? (
              <span className="text-[var(--primary)]">
                {" · "}
                {selectedDeparture!.price.toLocaleString("ko-KR")}원
              </span>
            ) : null}
          </p>
        ) : (
          <p className="font-medium text-amber-700">출발일을 선택해 주세요.</p>
        )
      ) : null}

      {hasOptions ? (
        <ul className="list-none space-y-0.5 text-slate-600">
          {optionLines.map((item) => (
            <li key={`${item.groupId}-${item.optionId}`}>
              {item.groupLabel}: {item.optionLabel}
              {item.priceDelta !== 0 ? (
                <span className="text-slate-500">
                  {" "}
                  ({item.priceDelta >= 0 ? "+" : ""}
                  {formatPriceKR(item.priceDelta) ?? "0"}원)
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : requiredGroupsMissing ? (
        <p className="font-medium text-amber-700">필수 옵션을 선택해 주세요.</p>
      ) : null}
    </div>
  );
}
