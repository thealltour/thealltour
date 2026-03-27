"use client";

import { X } from "lucide-react";
import type { ProductFiltersState } from "@/lib/productFilters";
import { SORT_OPTIONS, getCollectionLabel } from "@/lib/productFilters";
import { cn } from "@/lib/cn";

export type ProductFilterChipsProps = {
  filters: ProductFiltersState;
  onRemoveRegion: () => void;
  onRemoveTheme: () => void;
  onRemoveProductLine?: () => void;
  onRemoveKeyword?: () => void;
  onRemoveCollection?: () => void;
  onRemoveSort: () => void;
  className?: string;
};

export function ProductFilterChips({
  filters,
  onRemoveRegion,
  onRemoveTheme,
  onRemoveProductLine,
  onRemoveKeyword,
  onRemoveCollection,
  onRemoveSort,
  className,
}: ProductFilterChipsProps) {
  const hasRegion = Boolean(filters.region);
  const hasTheme = Boolean(filters.theme);
  const hasProductLine = Boolean(filters.product_line);
  const hasKeyword = Boolean(filters.q);
  const collectionLabel = getCollectionLabel(filters.collection);
  const hasCollection = Boolean(collectionLabel);
  const sortLabel = filters.sort
    ? SORT_OPTIONS.find((o) => o.value === filters.sort)?.label ?? filters.sort
    : null;
  const hasSort = Boolean(sortLabel);
  const hasAny = hasRegion || hasTheme || hasProductLine || hasKeyword || hasCollection || hasSort;

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
      {hasProductLine && onRemoveProductLine && (
        <span
          role="listitem"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--primary-soft)] px-3 py-1.5 type-caption font-semibold text-[var(--primary)]"
        >
          상품군: {filters.product_line}
          <button
            type="button"
            onClick={onRemoveProductLine}
            aria-label={`상품군 ${filters.product_line} 제거`}
            className="rounded-full p-0.5 transition hover:bg-[var(--primary)]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      )}
      {hasKeyword && onRemoveKeyword && (
        <span
          role="listitem"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 type-caption font-semibold text-[var(--foreground)]"
        >
          {/* 랜딩에서 city로 들어온 경우 "키워드: tokyo"처럼 보일 수 있음. 추후 "도시" 등 라벨 개선 여지 있음 */}
          키워드: {filters.q}
          <button
            type="button"
            onClick={onRemoveKeyword}
            aria-label={`키워드 ${filters.q} 제거`}
            className="rounded-full p-0.5 transition hover:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      )}
      {hasCollection && onRemoveCollection && (
        <span
          role="listitem"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--primary-soft)] px-3 py-1.5 type-caption font-semibold text-[var(--primary)]"
        >
          {collectionLabel}
          <button
            type="button"
            onClick={onRemoveCollection}
            aria-label={`${collectionLabel} 제거`}
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
