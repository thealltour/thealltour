"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/Card";
import type { QuoteResult } from "@/lib/pricing/calcQuote";
import { formatPriceKR } from "@/lib/pricing/calcQuote";

export type QuoteSummaryProps = {
  quote: QuoteResult;
  className?: string;
};

/**
 * 선택된 옵션만 반영한 예상 견적 요약.
 * - breakdown은 선택된 항목만 표시, 0원 변동 항목은 나열하지 않음.
 * - "예상 금액/예상 견적" 표현만 사용 (최종 결제 금액 등 확정 표현 금지).
 */
export function QuoteSummary({ quote, className = "" }: QuoteSummaryProps) {
  const lines = useMemo(() => {
    const result: { label: string; amount: number; isTotal?: boolean }[] = [];
    if (quote.basePrice != null) {
      result.push({ label: "기본가", amount: quote.basePrice });
    }
    quote.breakdown.forEach((item) => {
      if (item.priceDelta === 0) return;
      result.push({ label: item.optionLabel, amount: item.priceDelta });
    });
    if (quote.total != null && (result.length > 0 || quote.basePrice != null)) {
      result.push({ label: "합계", amount: quote.total, isTotal: true });
    }
    return result;
  }, [quote]);

  const totalFormatted = quote.total != null ? formatPriceKR(quote.total) : null;
  if (totalFormatted == null && lines.length === 0) return null;

  return (
    <Card
      variant="default"
      className={`border-[#dbeafe] bg-[#f8fbff] p-5 ring-[#dbeafe] ${className}`.trim()}
      aria-label="예상 견적"
    >
      <p className="text-sm font-semibold text-slate-500">예상 금액</p>
      {totalFormatted ? (
        <p className="font-price-strong mt-1 text-2xl font-bold text-[var(--primary)] md:text-3xl">
          ₩{totalFormatted}~
        </p>
      ) : null}
      {lines.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-[var(--divider)] pt-4">
          {lines.map((line, index) => (
            <li
              key={`${line.label}-${index}`}
              className={`flex justify-between text-sm ${line.isTotal ? "font-semibold text-[#0f172a]" : "text-slate-600"}`}
            >
              <span>
                {line.isTotal ? line.label : line.label === "기본가" ? "기본가" : `${line.label}:`}
              </span>
              <span>
                {line.isTotal
                  ? `₩${formatPriceKR(line.amount) ?? ""}~`
                  : line.amount >= 0
                    ? `+₩${formatPriceKR(line.amount) ?? ""}`
                    : `-₩${formatPriceKR(-line.amount) ?? ""}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
