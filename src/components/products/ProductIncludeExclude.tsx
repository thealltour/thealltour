"use client";

import { Icon } from "@/components/ui/Icon";

const MAX_ITEMS = 8;

export type ProductIncludeExcludeProps = {
  included: string[];
  excluded: string[];
};

/**
 * PR25: 포함/불포함 카드 UI.
 * 아이콘 기반 리스트 + leading-7로 스캔 밀도 정리.
 */
export function ProductIncludeExclude({ included, excluded }: ProductIncludeExcludeProps) {
  const includedItems = Array.isArray(included)
    ? included.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, MAX_ITEMS)
    : [];
  const excludedItems = Array.isArray(excluded)
    ? excluded.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, MAX_ITEMS)
    : [];

  if (includedItems.length === 0 && excludedItems.length === 0) return null;

  return (
    <div className="space-y-3" aria-label="포함 및 불포함 사항">
      {includedItems.length > 0 && (
        <div
          className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm md:p-4"
          aria-label="포함 사항"
        >
          <h3 className="mb-2 text-sm font-semibold text-foreground">포함 사항</h3>
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
          <h3 className="mb-2 text-sm font-semibold text-foreground">불포함 사항</h3>
          <ul className="flex flex-col gap-2 text-sm leading-7 text-slate-600">
            {excludedItems.map((label, i) => (
              <li key={`excluded-${i}-${label}`} className="flex items-start gap-2.5">
                <Icon
                  name="included"
                  decorative
                  size={16}
                  className="mt-1 shrink-0 text-slate-300"
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
