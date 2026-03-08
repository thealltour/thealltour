"use client";

import type { ProductFiltersState, ProductSortId } from "@/lib/productFilters";
import { PRODUCT_FILTER_KEYS, SORT_OPTIONS } from "@/lib/productFilters";
import { cn } from "@/lib/cn";

export type ProductFilterSidebarProps = {
  regionOptions: string[];
  themeOptions: string[];
  productLineOptions: string[];
  filters: ProductFiltersState;
  onFilterChange: (next: Partial<ProductFiltersState>) => void;
  /** 데스크톱에서만 보이므로 lg 이상에서 렌더 */
  className?: string;
};

export function ProductFilterSidebar({
  regionOptions,
  themeOptions,
  productLineOptions,
  filters,
  onFilterChange,
  className,
}: ProductFilterSidebarProps) {
  return (
    <aside
      className={cn(
        "hidden lg:block w-64 shrink-0 space-y-6",
        className,
      )}
      aria-label="상품 필터"
    >
      <div className="sticky top-24 space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-soft)]">
        {/* 지역 */}
        <fieldset className="space-y-2">
          <legend className="type-small font-semibold text-[var(--foreground)]">
            지역
          </legend>
          <ul className="space-y-1">
            <li>
              <label className="flex cursor-pointer items-center gap-2 py-1">
                <input
                  type="radio"
                  name={PRODUCT_FILTER_KEYS.REGION}
                  checked={!filters.region}
                  onChange={() => onFilterChange({ region: null })}
                  className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus-visible:ring-[var(--focus-ring)]"
                />
                <span className="type-caption text-[var(--text-primary)]">전체</span>
              </label>
            </li>
            {regionOptions.map((name) => (
              <li key={name}>
                <label className="flex cursor-pointer items-center gap-2 py-1">
                  <input
                    type="radio"
                    name={PRODUCT_FILTER_KEYS.REGION}
                    checked={filters.region === name}
                    onChange={() => onFilterChange({ region: name })}
                    className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus-visible:ring-[var(--focus-ring)]"
                  />
                  <span className="type-caption text-[var(--text-primary)]">{name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        {/* 테마 */}
        <fieldset className="space-y-2">
          <legend className="type-small font-semibold text-[var(--foreground)]">
            테마
          </legend>
          <ul className="space-y-1">
            <li>
              <label className="flex cursor-pointer items-center gap-2 py-1">
                <input
                  type="radio"
                  name={PRODUCT_FILTER_KEYS.THEME}
                  checked={!filters.theme}
                  onChange={() => onFilterChange({ theme: null })}
                  className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus-visible:ring-[var(--focus-ring)]"
                />
                <span className="type-caption text-[var(--text-primary)]">전체</span>
              </label>
            </li>
            {themeOptions.map((name) => (
              <li key={name}>
                <label className="flex cursor-pointer items-center gap-2 py-1">
                  <input
                    type="radio"
                    name={PRODUCT_FILTER_KEYS.THEME}
                    checked={filters.theme === name}
                    onChange={() => onFilterChange({ theme: name })}
                    className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus-visible:ring-[var(--focus-ring)]"
                  />
                  <span className="type-caption text-[var(--text-primary)]">{name}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>

        {/* 상품군 */}
        {productLineOptions.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="type-small font-semibold text-[var(--foreground)]">
              상품군
            </legend>
            <ul className="space-y-1">
              <li>
                <label className="flex cursor-pointer items-center gap-2 py-1">
                  <input
                    type="radio"
                    name={PRODUCT_FILTER_KEYS.PRODUCT_LINE}
                    checked={!filters.product_line}
                    onChange={() => onFilterChange({ product_line: null })}
                    className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus-visible:ring-[var(--focus-ring)]"
                  />
                  <span className="type-caption text-[var(--text-primary)]">전체</span>
                </label>
              </li>
              {productLineOptions.map((name) => (
                <li key={name}>
                  <label className="flex cursor-pointer items-center gap-2 py-1">
                    <input
                      type="radio"
                      name={PRODUCT_FILTER_KEYS.PRODUCT_LINE}
                      checked={filters.product_line === name}
                      onChange={() => onFilterChange({ product_line: name })}
                      className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus-visible:ring-[var(--focus-ring)]"
                    />
                    <span className="type-caption text-[var(--text-primary)]">{name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        )}

        {/* 정렬 */}
        <fieldset className="space-y-2">
          <legend className="type-small font-semibold text-[var(--foreground)]">
            정렬
          </legend>
          <ul className="space-y-1">
            {SORT_OPTIONS.filter((o) => o.value).map((opt) => (
              <li key={opt.value}>
                <label className="flex cursor-pointer items-center gap-2 py-1">
                  <input
                    type="radio"
                    name={PRODUCT_FILTER_KEYS.SORT}
                    checked={filters.sort === opt.value}
                    onChange={() => onFilterChange({ sort: opt.value as ProductSortId })}
                    className="h-4 w-4 border-[var(--border)] text-[var(--primary)] focus-visible:ring-[var(--focus-ring)]"
                  />
                  <span className="type-caption text-[var(--text-primary)]">{opt.label}</span>
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
      </div>
    </aside>
  );
}
