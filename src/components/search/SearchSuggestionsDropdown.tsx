"use client";

import type { SearchSuggestion } from "@/types/search";
import { cn } from "@/lib/cn";

const TYPE_LABELS: Record<SearchSuggestion["type"], string> = {
  destination: "지역",
  theme: "테마",
  product: "상품",
};

export type SearchSuggestionsDropdownProps = {
  open: boolean;
  suggestions: SearchSuggestion[];
  highlightedIndex: number;
  isLoading: boolean;
  query: string;
  onSelect: (suggestion: SearchSuggestion, index: number) => void;
  onMouseEnterItem: (index: number) => void;
};

export default function SearchSuggestionsDropdown({
  open,
  suggestions,
  highlightedIndex,
  isLoading,
  query,
  onSelect,
  onMouseEnterItem,
}: SearchSuggestionsDropdownProps) {
  if (!open) return null;

  if (isLoading) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-[var(--shadow-modal)]">
          <p className="text-xs text-[var(--text-muted)]">추천어를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0 && query.trim().length >= 2) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-[var(--shadow-modal)]">
          <p className="text-xs text-[var(--text-muted)]">일치하는 추천어가 없습니다.</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            검색어를 더 구체적으로 입력해보세요.
          </p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
      <ul
        id="hero-autosuggest-list"
        className="max-h-[min(70vh,320px)] overflow-y-auto overflow-x-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-[var(--shadow-modal)]"
        role="listbox"
        aria-label="검색 추천 목록"
      >
        {suggestions.map((item, index) => (
          <li
            key={item.id}
            id={`hero-suggestion-${index}`}
            role="option"
            aria-selected={index === highlightedIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item, index);
            }}
            onMouseEnter={() => onMouseEnterItem(index)}
            className={cn(
              "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition",
              index === highlightedIndex
                ? "bg-[var(--primary-soft)] text-[var(--foreground)]"
                : "text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
            )}
          >
            <span
              className={cn(
                "shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold",
                item.type === "destination" && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
                item.type === "theme" && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
                item.type === "product" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
              )}
            >
              {TYPE_LABELS[item.type]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.label}</p>
              {item.sublabel ? (
                <p className="truncate text-[11px] text-[var(--text-muted)]">{item.sublabel}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
