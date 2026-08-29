"use client";

import { cn } from "@/lib/cn";

export type ProductCostSummaryProps = {
  includedLines?: string[];
  excludedLines?: string[];
  optionalExpenseLines?: string[];
  fuelIncluded?: boolean;
  onOpenIncludedTab?: () => void;
  className?: string;
};

/**
 * 가격·예약 의사결정용 compact 비용 요약. 새 데이터 없이 기존 included/excluded 재사용.
 */
export function ProductCostSummary({
  includedLines = [],
  excludedLines = [],
  optionalExpenseLines = [],
  fuelIncluded,
  onOpenIncludedTab,
  className,
}: ProductCostSummaryProps) {
  const includedPreview = includedLines.slice(0, 3);
  const extraPreview = [
    ...optionalExpenseLines.slice(0, 2),
    ...excludedLines.slice(0, 2),
  ].slice(0, 3);

  const hasAny =
    includedPreview.length > 0 ||
    extraPreview.length > 0 ||
    typeof fuelIncluded === "boolean";

  if (!hasAny) return null;

  return (
    <section
      className={cn(
        "rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5",
        className,
      )}
      aria-label="포함·추가 비용 요약"
    >
      <h2 className="text-sm font-bold text-[var(--text-primary)]">비용 한눈에 보기</h2>

      {includedPreview.length > 0 ? (
        <div className="mt-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            포함된 항목
          </p>
          <ul className="mt-1.5 space-y-1">
            {includedPreview.map((line) => (
              <li key={line} className="text-sm leading-snug text-[var(--text-secondary)]">
                · {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {extraPreview.length > 0 || typeof fuelIncluded === "boolean" ? (
        <div className="mt-3">
          <p className="text-[0.6875rem] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            추가로 확인할 비용
          </p>
          <ul className="mt-1.5 space-y-1">
            {typeof fuelIncluded === "boolean" ? (
              <li className="text-sm leading-snug text-[var(--text-secondary)]">
                · {fuelIncluded ? "유류할증료 포함" : "유류할증료 별도 (상담 시 안내)"}
              </li>
            ) : null}
            {extraPreview.map((line) => (
              <li key={line} className="text-sm leading-snug text-[var(--text-secondary)]">
                · {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {onOpenIncludedTab ? (
        <button
          type="button"
          onClick={onOpenIncludedTab}
          className="mt-3 min-h-11 text-sm font-semibold text-[var(--primary)] hover:underline"
        >
          포함·불포함 자세히
        </button>
      ) : null}
    </section>
  );
}
