"use client";

import { Icon } from "@/components/ui/Icon";

const MAX_ITEMS = 30;

export type ProductIncludeExcludeProps = {
  included: string[];
  excluded: string[];
  optionalExpenses?: string[];
};

/**
 * PR25: 포함/불포함/선택경비 카드 UI.
 */
export function ProductIncludeExclude({
  included,
  excluded,
  optionalExpenses = [],
}: ProductIncludeExcludeProps) {
  const includedItems = Array.isArray(included)
    ? included.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, MAX_ITEMS)
    : [];
  const excludedItems = Array.isArray(excluded)
    ? excluded.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, MAX_ITEMS)
    : [];
  const optionalExpenseItems = Array.isArray(optionalExpenses)
    ? optionalExpenses
        .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
        .slice(0, MAX_ITEMS)
    : [];

  if (
    includedItems.length === 0 &&
    excludedItems.length === 0 &&
    optionalExpenseItems.length === 0
  ) {
    return null;
  }

  return (
    <div className="space-y-3" aria-label="포함, 불포함 및 선택경비">
      {includedItems.length > 0 && (
        <div
          className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm md:p-4"
          aria-label="포함 사항"
        >
          <h3 className="mb-2 text-sm font-semibold text-foreground">포함내역</h3>
          <ul className="flex flex-col gap-2 text-sm leading-7 text-slate-700">
            {includedItems.map((label, i) => (
              <li key={`included-${i}-${label}`} className="flex items-start gap-2.5">
                <Icon
                  name="included"
                  decorative
                  size={16}
                  className="mt-1 shrink-0 text-emerald-600"
                />
                <span className="min-w-0 whitespace-normal break-words">{label.trim()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {excludedItems.length > 0 && (
        <div
          className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm md:p-4"
          aria-label="불포함 사항"
        >
          <h3 className="mb-2 text-sm font-semibold text-foreground">불포함내역</h3>
          <ul className="flex flex-col gap-2 text-sm leading-7 text-slate-600">
            {excludedItems.map((label, i) => (
              <li key={`excluded-${i}-${label}`} className="flex items-start gap-2.5">
                <Icon
                  name="xCircle"
                  decorative
                  size={16}
                  className="mt-1 shrink-0 text-violet-500"
                />
                <span className="min-w-0 whitespace-normal break-words">{label.trim()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {optionalExpenseItems.length > 0 && (
        <div
          className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm md:p-4"
          aria-label="선택경비"
        >
          <h3 className="mb-2 text-sm font-semibold text-foreground">선택경비</h3>
          <ul className="flex flex-col gap-2 text-sm leading-7 text-slate-700">
            {optionalExpenseItems.map((label, i) => (
              <li key={`optional-${i}-${label}`} className="flex items-start gap-2.5">
                <Icon
                  name="check"
                  decorative
                  size={16}
                  className="mt-1 shrink-0 text-emerald-600"
                />
                <span className="min-w-0 whitespace-normal break-words">{label.trim()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
