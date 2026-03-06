"use client";

import { X } from "lucide-react";
import type { ProductFiltersState } from "@/lib/productFilters";
import { SORT_OPTIONS } from "@/lib/productFilters";
import { cn } from "@/lib/cn";

export type ProductFilterChipsProps = {
  filters: ProductFiltersState;
  onRemoveRegion: () => void;
  onRemoveTheme: () => void;
  onRemoveSort: () => void;
  className?: string;
};

export function ProductFilterChips({
  filters,
  onRemoveRegion,
  onRemoveTheme,
  onRemoveSort,
  className,
}: ProductFilterChipsProps) {
  const hasRegion = Boolean(filters.region);
  const hasTheme = Boolean(filters.theme);
  const sortLabel = filters.sort
    ? SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? filters.sort
    : null;
  const hasSort = Boolean(sortLabel);
  const hasAny = hasRegion || hasTheme || hasSort;

  if (!hasAny) return null;

  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      role="list"
      aria-label="선택된 필터"
    >
      {hasRegion && (
        <span
          role="listitem"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--primary-soft)] px-3 py-1.5 type-caption font-semibold text-[var(--primary)]"
        >
          지역: {filters.region}
          <button
            type="button"
            onClick={onRemoveRegion}
            aria-label={`지역 ${filters.region} 제거`}
            className="rounded-full p-0.5 transition hover:bg-[var(--primary)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      )}
      {hasTheme && (
        <span
          role="listitem"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--primary-soft)] px-3 py-1.5 type-caption font-semibold text-[var(--primary)]"
        >
          테마: {filters.theme}
          <button
            type="button"
            onClick={onRemoveTheme}
            aria-label={`테마 ${filters.theme} 제거`}
            className="rounded-full p-0.5 transition hover:bg-[var(--primary)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      )}
      {hasSort && (
        <span
          role="listitem"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 type-caption font-semibold text-[var(--text-primary)]"
        >
          {sortLabel}
          <button
            type="button"
            onClick={onRemoveSort}
            aria-label={`정렬 제거`}
            className="rounded-full p-0.5 transition hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      )}
    </div>
  );
}
