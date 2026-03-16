"use client";

const MAX_ITEMS = 8;

export type ProductIncludeExcludeProps = {
  included: string[];
  excluded: string[];
};

/**
 * PR25: 포함/불포함 카드 UI.
 * 모바일에서 스캔하기 쉬운 카드 형태로 포함·불포함 사항을 표시합니다.
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
    <div className="space-y-4" aria-label="포함 및 불포함 사항">
      {includedItems.length > 0 && (
        <div
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-[16px]"
          aria-label="포함 사항"
        >
          <h3 className="mb-3 text-sm font-semibold text-slate-800">포함 사항</h3>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-slate-700">
            {includedItems.map((label, i) => (
              <li key={`included-${i}-${label}`} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-emerald-600" aria-hidden>
                  ✓
                </span>
                <span className="break-words">{label.trim()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {excludedItems.length > 0 && (
        <div
          className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-[16px]"
          aria-label="불포함 사항"
        >
          <h3 className="mb-3 text-sm font-semibold text-slate-800">불포함 사항</h3>
          <ul className="flex flex-col gap-2 text-sm leading-relaxed text-slate-600">
            {excludedItems.map((label, i) => (
              <li key={`excluded-${i}-${label}`} className="flex items-start gap-2">
                <span className="mt-0.5 shrink-0 text-slate-400" aria-hidden>
                  ✗
                </span>
                <span className="break-words">{label.trim()}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
