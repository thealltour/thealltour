"use client";

import { SlidersHorizontal, ArrowDownUp, MapPin, Palette, Package, ChevronDown } from "lucide-react";
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
  currentRegion?: string | null;
  currentTheme?: string | null;
  currentProductLine?: string | null;
  onFilterClick: () => void;
  onSortClick: () => void;
  onSortChange: (sort: ProductSortId) => void;
  onCollectionChange: (collection: ProductCollectionId | null) => void;
  /**
   * true: `NavigationContextHeader`의 MobileBack 아래에 붙음.
   * false: SiteHeader 바로 아래(허브 랜딩 등 MobileBack 없는 목록).
   */
  belowMobileBackHeader?: boolean;
  /** Search Mode: collection 탭 숨김 */
  searchMode?: boolean;
  /** 데스크톱 정렬 옵션 (미지정 시 Browse 기본) */
  sortOptions?: { value: ProductSortId; label: string }[];
  /** 데스크톱에서 상품군 버튼 숨김 (모바일 필터 패널로만) — false면 표시 */
  hideDesktopProductLine?: boolean;
  className?: string;
};

const DESKTOP_SORT_OPTIONS: { value: ProductSortId; label: string }[] = [
  { value: "", label: "기본순" },
  ...SORT_OPTIONS,
];

function FilterChipButton({
  label,
  value,
  onClick,
  icon: Icon,
  className,
}: {
  label: string;
  value?: string | null;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  const active = Boolean(value?.trim());
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-10 min-w-0 max-w-[12rem] items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        active
          ? "border-[var(--primary)]/40 bg-[var(--primary-soft)] text-[var(--primary)]"
          : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]",
        className,
      )}
      aria-label={`${label} 필터 열기`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
      <span className="truncate">{active ? value : label}</span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
    </button>
  );
}

/**
 * 상단 필터·정렬 바.
 * 데스크톱: 지역·테마·상품군 + 정렬. 모바일: 지역·테마·정렬(+필터 패널에서 상품군).
 */
export function ProductListToolbar({
  sortLabel,
  currentSort,
  currentCollection,
  currentRegion = null,
  currentTheme = null,
  currentProductLine = null,
  onFilterClick,
  onSortClick,
  onSortChange,
  onCollectionChange,
  belowMobileBackHeader = false,
  searchMode = false,
  sortOptions,
  hideDesktopProductLine = false,
  className,
}: ProductListToolbarProps) {
  const desktopSortOptions = sortOptions ?? DESKTOP_SORT_OPTIONS;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
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
        {!searchMode ? (
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
        ) : null}

        {!searchMode ? (
          <div
            className="flex w-full items-center gap-2 overflow-x-auto lg:hidden"
            role="tablist"
            aria-label="상품 컬렉션 전환"
          >
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
        ) : null}

        {/* 데스크톱 상단 필터 칩 */}
        <div className="hidden min-w-0 flex-1 flex-wrap items-center gap-2 lg:flex">
          <FilterChipButton
            label="지역"
            value={currentRegion}
            onClick={onFilterClick}
            icon={MapPin}
          />
          <FilterChipButton
            label="테마"
            value={currentTheme}
            onClick={onFilterClick}
            icon={Palette}
          />
          {!hideDesktopProductLine ? (
            <FilterChipButton
              label="상품군"
              value={currentProductLine}
              onClick={onFilterClick}
              icon={Package}
            />
          ) : null}
        </div>

        {/* 모바일: 지역·테마·정렬 우선 */}
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
            aria-label="지역·테마·상품군 필터 열기"
          >
            <SlidersHorizontal className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
            <span className="truncate">
              {[currentRegion, currentTheme].filter(Boolean).join(" · ") || "지역 · 테마"}
            </span>
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

        <label className="hidden min-w-[200px] shrink-0 items-center gap-2 lg:flex">
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
            {desktopSortOptions.map((opt) => (
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
