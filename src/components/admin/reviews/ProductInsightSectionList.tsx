"use client";

type ProductInsightSectionListProps = {
  label: string;
  items: string[];
  emptyMessage?: string;
};

export function ProductInsightSectionList({
  label,
  items,
  emptyMessage = "항목 없음",
}: ProductInsightSectionListProps) {
  if (items.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold text-[var(--text-muted)]">{label}</p>
      <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-[var(--text-primary)]">
        {items.map((item, i) => (
          <li key={`${label}-${i}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
