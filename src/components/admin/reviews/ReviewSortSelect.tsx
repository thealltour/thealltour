"use client";

import type { ReviewSortOption } from "@/types/reviewSearch";
import { REVIEW_SORT_OPTIONS } from "@/lib/reviewSearchConstants";

type ReviewSortSelectProps = {
  value: ReviewSortOption;
  onChange: (value: ReviewSortOption) => void;
};

export function ReviewSortSelect({ value, onChange }: ReviewSortSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ReviewSortOption)}
      className="rounded border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text-primary)]"
      aria-label="정렬"
    >
      {REVIEW_SORT_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}
