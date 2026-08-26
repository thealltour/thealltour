"use client";

import { X } from "lucide-react";
import type { ProductFiltersState } from "@/lib/productFilters";
import { getCollectionLabel } from "@/lib/productFilters";
import { cn } from "@/lib/cn";

export type ProductFilterChipsProps = {
  filters: ProductFiltersState;
  onRemoveRegion: () => void;
  onRemoveTheme: () => void;
  onRemoveProductLine?: () => void;
  onRemoveKeyword?: () => void;
  onRemoveCollection?: () => void;
  /** @deprecated sort는 toolbar에서만 표시 — chip 미렌더. 호출부 호환용 optional */
  onRemoveSort?: () => void;
  className?: string;
};

/**
 * 활성 필터 chip.
 * sort는 ProductListToolbar / SortSheet에서만 노출하므로 여기서 렌더하지 않는다.
 */
export function ProductFilterChips({
  filters,
  onRemoveRegion,
  onRemoveTheme,
  onRemoveProductLine,
  onRemoveKeyword,
  onRemoveCollection,
  className,
}: ProductFilterChipsProps) {
  const hasRegion = Boolean(filters.region);
  const hasTheme = Boolean(filters.theme);
  const hasProductLine = Boolean(filters.product_line);
  const hasKeyword = Boolean(filters.q);
  const collectionLabel = getCollectionLabel(filters.collection);
  const hasCollection = Boolean(collectionLabel);
  const hasAny = hasRegion || hasTheme || hasProductLine || hasKeyword || hasCollection;

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
    </div>
  );
}
