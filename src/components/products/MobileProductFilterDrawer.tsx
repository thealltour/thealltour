"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, MapPin, Palette, Package, ChevronDown, ChevronRight } from "lucide-react";
import type { ProductFiltersState } from "@/lib/productFilters";
import { PRODUCT_FILTER_KEYS } from "@/lib/productFilters";
import { cn } from "@/lib/cn";
import type { RegionTreeNode } from "@/types/productTaxonomy";

/** 트리에서 name에 해당하는 노드까지의 경로(본인 포함) id 목록. 선택 시 자동 펼치기용 */
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

export type MobileProductFilterDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  regionOptions: string[];
  /** 지역 트리(대분류>중분류>소분류). 있으면 접이식 트리로 표시 */
  regionTree?: RegionTreeNode[];
  themeOptions: string[];
  /** 테마 트리(부모>자식). 있으면 접이식 트리로 표시 */
  themeTree?: RegionTreeNode[];
  productLineOptions: string[];
  filters: ProductFiltersState;
  onApply: (next: Partial<ProductFiltersState>) => void;
  onReset: () => void;
};

type DraftState = { region: string | null; theme: string | null; product_line: string | null };

/** 접이식 지역 트리 한 줄 (모바일 드로어용) */
function MobileRegionTreeRow({
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
          "flex items-center gap-1",
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
            className="flex h-10 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--text-muted)] active:bg-[var(--surface-muted)]"
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
          <span className="w-8 shrink-0" aria-hidden />
        )}
        <label
          className={cn(
            "flex flex-1 cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
            isSelected && "bg-[var(--primary-soft)] text-[var(--primary)]",
          )}
        >
          <input
            type="radio"
            name={radioName}
            checked={isSelected}
            onChange={() => onSelect(node.name)}
            className="h-4 w-4 border-[var(--border)] text-[var(--primary)]"
          />
          <span className="type-small font-medium">{node.name}</span>
        </label>
      </div>
      {hasChildren && isExpanded && (
        <ul className="mt-0.5 space-y-0.5">
          {node.children!.map((child) => (
            <MobileRegionTreeRow
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

export function MobileProductFilterDrawer({
  isOpen,
  onClose,
  regionOptions,
  regionTree,
  themeOptions,
  themeTree,
  productLineOptions,
  filters,
  onApply,
  onReset,
}: MobileProductFilterDrawerProps) {
  const [draft, setDraft] = useState<DraftState>({
    region: filters.region,
    theme: filters.theme,
    product_line: filters.product_line,
  });
  const [expandedRegionIds, setExpandedRegionIds] = useState<Set<string>>(() => new Set());
  const [expandedThemeIds, setExpandedThemeIds] = useState<Set<string>>(() => new Set());

  const useRegionTree = regionTree && regionTree.length > 0;
  const useThemeTree = themeTree && themeTree.length > 0;

  // 선택한 지역이 있으면 해당 노드까지 경로를 펼쳐서 하위가 보이게 함 (드로어 열릴 때/초기 선택 반영)
  useEffect(() => {
    if (!useRegionTree || !draft.region) return;
    const pathIds = getNodePathIds(regionTree, draft.region);
    if (pathIds.length === 0) return;
    setExpandedRegionIds((prev) => {
      const next = new Set(prev);
      pathIds.forEach((id) => next.add(id));
      return next;
    });
  }, [useRegionTree, draft.region, regionTree]);

  const toggleRegionExpand = (id: string) => {
    setExpandedRegionIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // 선택한 테마가 있으면 해당 노드까지 경로를 펼쳐서 하위가 보이게 함
  useEffect(() => {
    if (!useThemeTree || !draft.theme) return;
    const pathIds = getNodePathIds(themeTree, draft.theme);
    if (pathIds.length === 0) return;
    setExpandedThemeIds((prev) => {
      const next = new Set(prev);
      pathIds.forEach((id) => next.add(id));
      return next;
    });
  }, [useThemeTree, draft.theme, themeTree]);

  const toggleThemeExpand = (id: string) => {
    setExpandedThemeIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    setDraft({ region: filters.region, theme: filters.theme, product_line: filters.product_line });
  }, [isOpen, filters.region, filters.theme, filters.product_line]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  function handleApply() {
    onApply({ region: draft.region, theme: draft.theme, product_line: draft.product_line });
    onClose();
  }

  function handleReset() {
    setDraft({ region: null, theme: null, product_line: null });
    onReset();
    onClose();
  }

  if (!isOpen) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="필터"
    >
      <button
        type="button"
        aria-label="배경 닫기"
        className="absolute inset-0 bg-[var(--overlay)]"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[85vh] flex-col rounded-t-2xl border border-b-0 border-[var(--border)]",
          "bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)]",
          "safe-bottom",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--border)] px-4 py-3">
          <div>
            <h2 className="type-small font-semibold text-[var(--foreground)]">필터</h2>
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">지역·테마·상품군을 선택하세요</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors active:bg-[var(--surface-muted)]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <fieldset className="space-y-2">
            <legend className="flex items-center gap-2 type-small font-semibold text-[var(--foreground)]">
              <MapPin className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
              지역
            </legend>
            <ul className="mt-2 space-y-0.5">
              <li>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
                    !draft.region && "bg-[var(--primary-soft)] text-[var(--primary)]",
                  )}
                >
                  <input
                    type="radio"
                    name={`${PRODUCT_FILTER_KEYS.REGION}-mobile`}
                    checked={!draft.region}
                    onChange={() => setDraft((p) => ({ ...p, region: null }))}
                    className="h-4 w-4 border-[var(--border)] text-[var(--primary)]"
                  />
                  <span className="type-small font-medium">전체</span>
                </label>
              </li>
              {useRegionTree
                ? regionTree.map((node) => (
                    <MobileRegionTreeRow
                      key={node.id}
                      node={node}
                      depth={0}
                      expandedIds={expandedRegionIds}
                      onToggle={toggleRegionExpand}
                      selectedRegion={draft.region}
                      onSelect={(name) => setDraft((p) => ({ ...p, region: name }))}
                      radioName={`${PRODUCT_FILTER_KEYS.REGION}-mobile`}
                    />
                  ))
                : regionOptions.map((name) => (
                    <li key={name}>
                      <label
                        className={cn(
                          "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
                          draft.region === name && "bg-[var(--primary-soft)] text-[var(--primary)]",
                        )}
                      >
                        <input
                          type="radio"
                          name={`${PRODUCT_FILTER_KEYS.REGION}-mobile`}
                          checked={draft.region === name}
                          onChange={() => setDraft((p) => ({ ...p, region: name }))}
                          className="h-4 w-4 border-[var(--border)] text-[var(--primary)]"
                        />
                        <span className="type-small font-medium">{name}</span>
                      </label>
                    </li>
                  ))}
            </ul>
          </fieldset>

          <fieldset className="mt-6 space-y-2">
            <legend className="flex items-center gap-2 type-small font-semibold text-[var(--foreground)]">
              <Palette className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
              테마
            </legend>
            <ul className="mt-2 space-y-0.5">
              <li>
                <label
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
                    !draft.theme && "bg-[var(--primary-soft)] text-[var(--primary)]",
                  )}
                >
                  <input
                    type="radio"
                    name={`${PRODUCT_FILTER_KEYS.THEME}-mobile`}
                    checked={!draft.theme}
                    onChange={() => setDraft((p) => ({ ...p, theme: null }))}
                    className="h-4 w-4 border-[var(--border)] text-[var(--primary)]"
                  />
                  <span className="type-small font-medium">전체</span>
                </label>
              </li>
              {useThemeTree
                ? themeTree.map((node) => (
                    <MobileRegionTreeRow
                      key={node.id}
                      node={node}
                      depth={0}
                      expandedIds={expandedThemeIds}
                      onToggle={toggleThemeExpand}
                      selectedRegion={draft.theme}
                      onSelect={(name) => setDraft((p) => ({ ...p, theme: name }))}
                      radioName={`${PRODUCT_FILTER_KEYS.THEME}-mobile`}
                    />
                  ))
                : themeOptions.map((name) => (
                <li key={name}>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
                      draft.theme === name && "bg-[var(--primary-soft)] text-[var(--primary)]",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${PRODUCT_FILTER_KEYS.THEME}-mobile`}
                      checked={draft.theme === name}
                      onChange={() => setDraft((p) => ({ ...p, theme: name }))}
                      className="h-4 w-4 border-[var(--border)] text-[var(--primary)]"
                    />
                    <span className="type-small font-medium">{name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          {productLineOptions.length > 0 && (
            <fieldset className="mt-6 space-y-2">
              <legend className="flex items-center gap-2 type-small font-semibold text-[var(--foreground)]">
                <Package className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
                상품군
              </legend>
              <ul className="mt-2 space-y-0.5">
                <li>
                  <label
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
                      !draft.product_line && "bg-[var(--primary-soft)] text-[var(--primary)]",
                    )}
                  >
                    <input
                      type="radio"
                      name={`${PRODUCT_FILTER_KEYS.PRODUCT_LINE}-mobile`}
                      checked={!draft.product_line}
                      onChange={() => setDraft((p) => ({ ...p, product_line: null }))}
                      className="h-4 w-4 border-[var(--border)] text-[var(--primary)]"
                    />
                    <span className="type-small font-medium">전체</span>
                  </label>
                </li>
                {productLineOptions.map((name) => (
                  <li key={name}>
                    <label
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5",
                        draft.product_line === name && "bg-[var(--primary-soft)] text-[var(--primary)]",
                      )}
                    >
                      <input
                        type="radio"
                        name={`${PRODUCT_FILTER_KEYS.PRODUCT_LINE}-mobile`}
                        checked={draft.product_line === name}
                        onChange={() => setDraft((p) => ({ ...p, product_line: name }))}
                        className="h-4 w-4 border-[var(--border)] text-[var(--primary)]"
                      />
                      <span className="type-small font-medium">{name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}
        </div>

        <div className="flex shrink-0 gap-3 border-t border-[var(--border)] p-4 safe-bottom">
          <button
            type="button"
            onClick={handleReset}
            className="flex-1 rounded-xl border border-[var(--border)] bg-transparent py-3 type-small font-semibold text-[var(--text-primary)] transition-colors active:bg-[var(--surface-muted)]"
          >
            초기화
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="flex-1 rounded-xl bg-[var(--primary)] py-3 type-small font-semibold text-[var(--on-primary)] transition-opacity active:opacity-90"
          >
            적용
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
