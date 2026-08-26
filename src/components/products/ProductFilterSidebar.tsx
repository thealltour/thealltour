"use client";

import { useState, useEffect } from "react";
import { MapPin, Palette, Package, ArrowDownUp, RotateCcw, ChevronDown, ChevronRight } from "lucide-react";
import type { ProductFiltersState, ProductSortId } from "@/lib/productFilters";
import { PRODUCT_FILTER_KEYS, SORT_OPTIONS, SEARCH_SORT_OPTIONS } from "@/lib/productFilters";
import { cn } from "@/lib/cn";
import type { RegionTreeNode } from "@/types/productTaxonomy";

export type ProductFilterSidebarProps = {
  regionOptions: string[];
  /** 지역 트리(대분류>중분류>소분류). 있으면 접이식 트리로 표시 */
  regionTree?: RegionTreeNode[];
  themeOptions: string[];
  /** 테마 트리(부모>자식). 있으면 접이식 트리로 표시 */
  themeTree?: RegionTreeNode[];
  productLineOptions: string[];
  filters: ProductFiltersState;
  onFilterChange: (next: Partial<ProductFiltersState>) => void;
  /** Search Mode: relevance 등 검색 정렬 옵션 */
  searchMode?: boolean;
  /** 데스크톱에서만 보이므로 lg 이상에서 렌더 */
  className?: string;
};

function FilterSection({
  legend,
  icon: Icon,
  children,
}: {
  legend: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="flex items-center gap-2 type-small font-semibold text-[var(--foreground)]">
        <Icon className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
        {legend}
      </legend>
      <ul className="space-y-0.5">{children}</ul>
    </fieldset>
  );
}

function FilterOption({
  label,
  checked,
  onChange,
  radioName,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  radioName: string;
}) {
  return (
    <li>
      <label
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 transition-colors",
          "hover:bg-[var(--surface-muted)]",
          "focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:ring-offset-1 focus-within:ring-offset-[var(--surface)]",
          checked && "bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary-soft)]",
        )}
      >
        <input
          type="radio"
          name={radioName}
          checked={checked}
          onChange={onChange}
          className="h-4 w-4 shrink-0 border-[var(--border)] text-[var(--primary)] focus:ring-0 focus:ring-offset-0"
        />
        <span className="type-small font-medium">{label}</span>
      </label>
    </li>
  );
}

/** 트리에서 name에 해당하는 노드까지의 경로(본인 포함) id 목록 반환. 선택 시 해당 노드·조상 펼치기용 */
function getNodePathIds(tree: RegionTreeNode[], targetName: string): string[] {
  const path: string[] = [];
  function find(nodes: RegionTreeNode[], target: string): boolean {
    for (const node of nodes) {
      path.push(node.id);
      if (node.name === target) return true;
      if (node.children && find(node.children, target)) return true;
      path.pop();
    }
    return false;
  }
  find(tree, targetName);
  return path;
}

/** 접이식 지역 트리 노드 1개. 자식이 있으면 Chevron으로 펼치기/접기 */
function RegionTreeRow({
  node,
  depth,
  expandedIds,
  onToggle,
  selectedRegion,
  onSelect,
  radioName,
}: {
  node: RegionTreeNode;
  depth: number;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  selectedRegion: string | null;
  onSelect: (name: string) => void;
  radioName: string;
}) {
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedIds.has(node.id);
  const isSelected = selectedRegion === node.name;

  return (
    <li className="list-none">
      <div
        className={cn(
          "flex items-center gap-1 rounded-lg transition-colors",
          depth === 0 ? "" : depth === 1 ? "pl-4" : "pl-7",
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggle(node.id);
            }}
            className="flex h-8 w-7 shrink-0 items-center justify-center rounded text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]"
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "접기" : "펼치기"}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" aria-hidden />
            ) : (
              <ChevronRight className="h-4 w-4" aria-hidden />
            )}
          </button>
        ) : (
          <span className="w-7 shrink-0" aria-hidden />
        )}
        <label
          className={cn(
            "flex flex-1 cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors",
            "hover:bg-[var(--surface-muted)]",
            "focus-within:ring-2 focus-within:ring-[var(--focus-ring)] focus-within:ring-offset-1 focus-within:ring-offset-[var(--surface)]",
            isSelected && "bg-[var(--primary-soft)] text-[var(--primary)] hover:bg-[var(--primary-soft)]",
          )}
        >
          <input
            type="radio"
            name={radioName}
            checked={isSelected}
            onChange={() => onSelect(node.name)}
            className="h-4 w-4 shrink-0 border-[var(--border)] text-[var(--primary)] focus:ring-0 focus:ring-offset-0"
          />
          <span className="type-small font-medium">{node.name}</span>
        </label>
      </div>
      {hasChildren && isExpanded && (
        <ul className="mt-0.5 space-y-0.5">
          {node.children!.map((child) => (
            <RegionTreeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggle={onToggle}
              selectedRegion={selectedRegion}
              onSelect={onSelect}
              radioName={radioName}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

export function ProductFilterSidebar({
  regionOptions,
  regionTree,
  themeOptions,
  themeTree,
  productLineOptions,
  filters,
  onFilterChange,
  searchMode = false,
  className,
}: ProductFilterSidebarProps) {
  const [expandedRegionIds, setExpandedRegionIds] = useState<Set<string>>(() => new Set());
  const [expandedThemeIds, setExpandedThemeIds] = useState<Set<string>>(() => new Set());

  const useRegionTree = regionTree && regionTree.length > 0;
  const useThemeTree = themeTree && themeTree.length > 0;

  // 선택한 지역이 있으면 해당 노드까지 경로(조상+본인)를 펼쳐서 하위가 보이게 함
  useEffect(() => {
    if (!useRegionTree || !filters.region) return;
    const pathIds = getNodePathIds(regionTree, filters.region);
    if (pathIds.length === 0) return;
    setExpandedRegionIds((prev) => {
      const next = new Set(prev);
      pathIds.forEach((id) => next.add(id));
      return next;
    });
  }, [useRegionTree, filters.region, regionTree]);

  const toggleRegionExpand = (id: string) => {
    setExpandedRegionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 선택한 테마가 있으면 해당 노드까지 경로(조상+본인)를 펼쳐서 하위가 보이게 함
  useEffect(() => {
    if (!useThemeTree || !filters.theme) return;
    const pathIds = getNodePathIds(themeTree, filters.theme);
    if (pathIds.length === 0) return;
    setExpandedThemeIds((prev) => {
      const next = new Set(prev);
      pathIds.forEach((id) => next.add(id));
      return next;
    });
  }, [useThemeTree, filters.theme, themeTree]);

  const toggleThemeExpand = (id: string) => {
    setExpandedThemeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const hasActiveFilter =
    Boolean(filters.region) ||
    Boolean(filters.theme) ||
    Boolean(filters.product_line) ||
    Boolean(filters.sort);

  function handleResetAll() {
    onFilterChange({
      region: null,
      theme: null,
      product_line: null,
      sort: "",
    });
  }

  return (
    <aside
      className={cn("hidden w-72 shrink-0 lg:block", className)}
      aria-label="상품 필터"
    >
      <div className="sticky top-24 space-y-0 rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] px-4 py-3">
          <h2 className="type-small font-semibold text-[var(--foreground)]">필터</h2>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">
            지역·테마·정렬로 상품을 좁혀보세요
          </p>
        </div>

        <div className="space-y-5 p-4">
          <FilterSection legend="지역" icon={MapPin}>
            <FilterOption
              label="전체"
              checked={!filters.region}
              onChange={() => onFilterChange({ region: null })}
              radioName={PRODUCT_FILTER_KEYS.REGION}
            />
            {useRegionTree ? (
              <ul className="mt-1 space-y-0.5">
                {regionTree.map((node) => (
                  <RegionTreeRow
                    key={node.id}
                    node={node}
                    depth={0}
                    expandedIds={expandedRegionIds}
                    onToggle={toggleRegionExpand}
                    selectedRegion={filters.region}
                    onSelect={(name) => onFilterChange({ region: name })}
                    radioName={PRODUCT_FILTER_KEYS.REGION}
                  />
                ))}
              </ul>
            ) : (
              regionOptions.map((name) => (
                <FilterOption
                  key={name}
                  label={name}
                  checked={filters.region === name}
                  onChange={() => onFilterChange({ region: name })}
                  radioName={PRODUCT_FILTER_KEYS.REGION}
                />
              ))
            )}
          </FilterSection>

          <FilterSection legend="테마" icon={Palette}>
            <FilterOption
              label="전체"
              checked={!filters.theme}
              onChange={() => onFilterChange({ theme: null })}
              radioName={PRODUCT_FILTER_KEYS.THEME}
            />
            {useThemeTree ? (
              <ul className="mt-1 space-y-0.5">
                {themeTree.map((node) => (
                  <RegionTreeRow
                    key={node.id}
                    node={node}
                    depth={0}
                    expandedIds={expandedThemeIds}
                    onToggle={toggleThemeExpand}
                    selectedRegion={filters.theme}
                    onSelect={(name) => onFilterChange({ theme: name })}
                    radioName={PRODUCT_FILTER_KEYS.THEME}
                  />
                ))}
              </ul>
            ) : (
              themeOptions.map((name) => (
                <FilterOption
                  key={name}
                  label={name}
                  checked={filters.theme === name}
                  onChange={() => onFilterChange({ theme: name })}
                  radioName={PRODUCT_FILTER_KEYS.THEME}
                />
              ))
            )}
          </FilterSection>

          {productLineOptions.length > 0 && (
            <FilterSection legend="상품군" icon={Package}>
              <FilterOption
                label="전체"
                checked={!filters.product_line}
                onChange={() => onFilterChange({ product_line: null })}
                radioName={PRODUCT_FILTER_KEYS.PRODUCT_LINE}
              />
              {productLineOptions.map((name) => (
                <FilterOption
                  key={name}
                  label={name}
                  checked={filters.product_line === name}
                  onChange={() => onFilterChange({ product_line: name })}
                  radioName={PRODUCT_FILTER_KEYS.PRODUCT_LINE}
                />
              ))}
            </FilterSection>
          )}

          <FilterSection legend="정렬" icon={ArrowDownUp}>
            {(searchMode ? SEARCH_SORT_OPTIONS : SORT_OPTIONS).filter((o) => o.value).map((opt) => (
              <FilterOption
                key={opt.value}
                label={opt.label}
                checked={filters.sort === opt.value}
                onChange={() => onFilterChange({ sort: opt.value as ProductSortId })}
                radioName={PRODUCT_FILTER_KEYS.SORT}
              />
            ))}
          </FilterSection>
        </div>

        {hasActiveFilter && (
          <div className="border-t border-[var(--border)] p-4">
            <button
              type="button"
              onClick={handleResetAll}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)]",
                "bg-[var(--surface-muted)] py-2.5 type-small font-semibold text-[var(--text-primary)]",
                "transition-colors hover:bg-[var(--surface-muted)]/80 hover:border-[var(--border-strong)]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
              )}
            >
              <RotateCcw className="h-4 w-4 shrink-0" aria-hidden />
              필터 초기화
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
