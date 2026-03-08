"use client";

import type { ReviewVariantConversionSummary } from "@/types/reviewConversionAnalytics";
import type { VariantLiftResult } from "@/lib/reviewConversionComparisons";

type ReviewConversionByVariantTableProps = {
  variantSummaries: ReviewVariantConversionSummary[];
  variantLift: VariantLiftResult[];
};

export function ReviewConversionByVariantTable({
  variantSummaries,
  variantLift,
}: ReviewConversionByVariantTableProps) {
  const withLift = variantSummaries.map((s) => {
    const lift = variantLift.find(
      (l) => l.experimentKey === s.experimentKey && l.variant === s.variant,
    );
    return { ...s, liftPercent: lift?.liftPercent };
  });
  const sorted = [...withLift].sort((a, b) => b.impressions - a.impressions);

  if (sorted.length === 0) {
    return (
      <p className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-muted)]">
        Variant별 전환 데이터가 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[520px] text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[var(--text-muted)]">
            <th className="px-3 py-2 font-medium">Experiment</th>
            <th className="px-3 py-2 font-medium">Variant</th>
            <th className="px-3 py-2 font-medium text-right">Impressions</th>
            <th className="px-3 py-2 font-medium text-right">Conversions</th>
            <th className="px-3 py-2 font-medium text-right">Assisted</th>
            <th className="px-3 py-2 font-medium text-right">CVR %</th>
            <th className="px-3 py-2 font-medium text-right">Lift vs Control</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((s, i) => (
            <tr key={`${s.experimentKey}-${s.variant}-${i}`} className="border-b border-[var(--border)]">
              <td className="px-3 py-2">{s.experimentKey ?? "-"}</td>
              <td className="px-3 py-2">{s.variant ?? "-"}</td>
              <td className="px-3 py-2 text-right">{s.impressions}</td>
              <td className="px-3 py-2 text-right">{s.conversions.toFixed(2)}</td>
              <td className="px-3 py-2 text-right">{s.assistedConversions}</td>
              <td className="px-3 py-2 text-right">
                {s.impressions > 0 ? (s.conversionRate * 100).toFixed(2) : "-"}%
              </td>
              <td className="px-3 py-2 text-right">
                {"liftPercent" in s && typeof (s as { liftPercent?: number }).liftPercent === "number"
                  ? `${(s as { liftPercent: number }).liftPercent}%`
                  : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
