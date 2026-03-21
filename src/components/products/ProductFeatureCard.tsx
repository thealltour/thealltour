"use client";

const MAX_ITEMS = 5;

export type ProductFeatureCardProps = {
  features: string[];
};

/**
 * PR24: 여행 특징 카드.
 * 일정 미리보기 아래에서 이 여행의 핵심 특징을 최대 5개까지 체크 리스트 형태로 표시합니다.
 */
export function ProductFeatureCard({ features }: ProductFeatureCardProps) {
  const items = Array.isArray(features)
    ? features.filter((s): s is string => typeof s === "string" && s.trim().length > 0).slice(0, MAX_ITEMS)
    : [];

  if (items.length === 0) return null;

  return (
    <div
      className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      aria-label="이 여행의 특징"
    >
      <h2 className="mb-4 text-sm font-semibold text-slate-800">이 여행의 특징</h2>
      <ul className="flex flex-col gap-2 text-sm leading-relaxed text-slate-700">
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
