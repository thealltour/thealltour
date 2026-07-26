"use client";

import { SlidersHorizontal, ArrowDownUp } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  PRODUCT_COLLECTION_SWITCH_OPTIONS,
  type ProductCollectionId,
  SORT_OPTIONS,
  type ProductSortId,
} from "@/lib/productFilters";

export type ProductListToolbarProps = {
  sortLabel: string | null;
  currentSort: ProductSortId;
  currentCollection: string | null;
  onFilterClick: () => void;
  onSortClick: () => void;
  onSortChange: (sort: ProductSortId) => void;
  onCollectionChange: (collection: ProductCollectionId | null) => void;
  /**
   * true: `NavigationContextHeader`의 MobileBack 아래에 붙음.
   * false: SiteHeader 바로 아래(허브 랜딩 등 MobileBack 없는 목록).
   */
  belowMobileBackHeader?: boolean;
  className?: string;
};

const DESKTOP_SORT_OPTIONS: { value: ProductSortId; label: string }[] = [
  { value: "", label: "기본순" },
  ...SORT_OPTIONS,
];

/**
 * 모바일: SiteHeader·MobileBack 아래 sticky 필터/정렬 바.
 * 데스크톱: 정렬 셀렉트(우측) — 필터는 사이드바 유지.
 */
export function ProductListToolbar({
  sortLabel,
  currentSort,
  currentCollection,
  onFilterClick,
  onSortClick,
  onSortChange,
  onCollectionChange,
  belowMobileBackHeader = false,
  className,
}: ProductListToolbarProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        className,
      )}
    >
      {/* 모바일 sticky */}
      <div
        className={cn(
          "sticky z-30 flex w-full flex-col gap-2 rounded-xl px-0.5 py-2",
          "border-b border-[var(--border)]/40 glass-chrome",
          belowMobileBackHeader
            ? "top-[var(--products-mobile-toolbar-top)]"
            : "top-[var(--products-mobile-stack-top)]",
          "lg:static lg:top-auto lg:z-0 lg:flex-row lg:items-center lg:justify-between lg:gap-4 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none lg:[backdrop-filter:none] lg:[-webkit-backdrop-filter:none]",
        )}
      >
        <div className="hidden items-center gap-2 lg:flex" role="tablist" aria-label="상품 컬렉션 전환">
          {PRODUCT_COLLECTION_SWITCH_OPTIONS.map((opt) => {
            const isActive = (opt.value ?? "") === (currentCollection ?? "");
            return (
              <button
                key={`desktop-collection-${opt.value ?? "all"}`}
                type="button"
                onClick={() => onCollectionChange(opt.value)}
                className={cn(
                  "inline-flex h-10 items-center justify-center rounded-full px-4 text-sm font-semibold transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  isActive
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]",
                )}
                aria-pressed={isActive}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex w-full items-center gap-2 overflow-x-auto lg:hidden" role="tablist" aria-label="상품 컬렉션 전환">
          {PRODUCT_COLLECTION_SWITCH_OPTIONS.map((opt) => {
            const isActive = (opt.value ?? "") === (currentCollection ?? "");
            return (
              <button
                key={`mobile-collection-${opt.value ?? "all"}`}
                type="button"
                onClick={() => onCollectionChange(opt.value)}
                className={cn(
                  "inline-flex h-8 shrink-0 items-center justify-center rounded-full px-3 text-xs font-semibold transition",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  isActive
                    ? "bg-[var(--primary-soft)] text-[var(--primary)]"
                    : "border border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] active:bg-[var(--surface-muted)]",
                )}
                aria-pressed={isActive}
              >
                {opt.label}
              </button>
            );
          })}
        </div>

        <div className="flex min-w-0 flex-1 items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={onFilterClick}
            className={cn(
              "inline-flex h-11 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl",
              "border border-[var(--border)]/80 bg-[var(--surface)]/90 text-sm font-medium text-[var(--foreground)]",
              "active:bg-[var(--surface-muted)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            )}
            aria-label="필터 열기"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            필터
          </button>
          <button
            type="button"
            onClick={onSortClick}
            className={cn(
              "inline-flex h-11 min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl",
              "border border-[var(--border)]/80 bg-[var(--surface)]/90 text-sm font-medium text-[var(--foreground)]",
              "active:bg-[var(--surface-muted)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            )}
            aria-label="정렬 열기"
          >
            <ArrowDownUp className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">{sortLabel ?? "정렬"}</span>
          </button>
        </div>

        {/* 데스크톱 정렬 */}
        <label className="hidden min-w-[200px] items-center gap-2 lg:flex">
          <span className="shrink-0 text-sm text-[var(--text-muted)]">정렬</span>
          <select
            value={currentSort}
            onChange={(e) => onSortChange((e.target.value || "") as ProductSortId)}
            className={cn(
              "h-10 w-full min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)]",
              "px-3 text-sm text-[var(--foreground)] shadow-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
            )}
            aria-label="상품 정렬"
          >
            {DESKTOP_SORT_OPTIONS.map((opt) => (
              <option key={opt.label + String(opt.value)} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
