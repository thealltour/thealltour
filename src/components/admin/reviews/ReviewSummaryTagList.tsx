"use client";

type ReviewSummaryTagListProps = {
  label: string;
  items: string[];
  emptyText?: string;
};

export function ReviewSummaryTagList({
  label,
  items,
  emptyText = "없음",
}: ReviewSummaryTagListProps) {
  return (
    <div>
      <p className="text-xs font-medium text-[var(--text-muted)]">{label}</p>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-[var(--text-muted)]">{emptyText}</p>
      ) : (
        <ul className="mt-1 flex flex-wrap gap-1.5">
          {items.map((item, i) => (
            <li
              key={`${item}-${i}`}
              className="inline-flex rounded-full bg-[var(--surface-muted)] px-2.5 py-0.5 text-xs text-[var(--text-primary)]"
            >
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
