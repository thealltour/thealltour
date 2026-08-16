"use client";

const MAX_ITEMS = 5;

export type ProductHighlightsCardProps = {
  highlights: string[];
};

/**
 * PR22: 핵심 여행 요약 카드.
 * 상품 상세 Hero 아래에서 여행의 핵심 특징을 최대 5개까지 체크 리스트 형태로 표시합니다.
 */
export function ProductHighlightsCard({ highlights }: ProductHighlightsCardProps) {
  const items = Array.isArray(highlights)
    ? highlights.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, MAX_ITEMS)
    : [];

  if (items.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      aria-label="핵심 여행 요약"
    >
      <h2 className="mb-4 text-base font-bold text-slate-900">핵심 여행 요약</h2>
      <ul className="flex flex-col gap-2 text-sm text-slate-700">
        {items.map((label, i) => (
          <li key={`${i}-${label}`} className="flex items-center gap-2">
            <span className="shrink-0 text-[var(--primary)]" aria-hidden>
              ✓
            </span>
            <span>{label.trim()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
