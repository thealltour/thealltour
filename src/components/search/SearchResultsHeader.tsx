"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { SearchFilterState, SearchSortOption } from "@/types/search";
import { buildSearchUrl, updateSearchQueryParams, withPageOne, DEFAULT_SORT } from "@/lib/search/searchQueryParams";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

const SORT_LABELS: Record<SearchSortOption, string> = {
  relevance: "관련도순",
  latest: "최신순",
  price_asc: "가격 낮은순",
  price_desc: "가격 높은순",
};

export type SearchResultsHeaderProps = {
  /** 현재 검색/필터 상태 */
  current: SearchFilterState;
  /** 결과 개수 */
  totalCount: number;
  /** 총 페이지 수 (페이지네이션 시) */
  totalPages?: number;
  /** 현재 페이지 (페이지네이션 시) */
  currentPage?: number;
  /** 정렬 변경 시 (URL 갱신은 부모에서 처리해도 됨) */
  onSortChange?: (sort: SearchSortOption) => void;
};

export default function SearchResultsHeader({
  current,
  totalCount,
  totalPages,
  currentPage,
  onSortChange,
}: SearchResultsHeaderProps) {
  const router = useRouter();
  const relevanceTrackedRef = useRef(false);

  useEffect(() => {
    if (current.sort !== "relevance" || totalCount <= 0 || relevanceTrackedRef.current) return;
    relevanceTrackedRef.current = true;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.search_relevance_sort,
        source: ANALYTICS_SOURCES.hero_search,
        query: current.q ?? null,
        resultCount: totalCount,
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("desktop"),
      }),
    );
  }, [current.sort, current.q, totalCount]);

  const hasQuery = Boolean(current.q);
  const hasFilters = Boolean(current.destination || current.theme || current.product_line);
  const title = hasQuery ? `"${current.q}" 검색 결과` : "상품 검색 결과";

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as SearchSortOption;
    const next = withPageOne(updateSearchQueryParams(current, { sort: value }));
    const url = buildSearchUrl(next);
    router.push(url);
    onSortChange?.(value);
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.search_sort_change,
        source: ANALYTICS_SOURCES.hero_search,
        query: current.q ?? null,
        section: value,
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("desktop"),
      }),
    );
  };

  const removeFilter = (key: keyof Pick<SearchFilterState, "destination" | "theme" | "product_line">) => {
    const next = withPageOne(updateSearchQueryParams(current, { [key]: "" }));
    router.push(buildSearchUrl(next));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="heading-display type-h2 text-[var(--foreground)]">{title}</h1>
        <div className="flex items-center gap-2">
          <span className="type-small text-[var(--text-muted)]">
            총 {totalCount}개 상품
            {totalPages != null && totalPages > 1 && currentPage != null && (
              <span className="ml-1.5">· {currentPage} / {totalPages} 페이지</span>
            )}
          </span>
          <select
            value={current.sort ?? DEFAULT_SORT}
            onChange={handleSortChange}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 type-small text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            aria-label="정렬"
          >
            {(Object.entries(SORT_LABELS) as [SearchSortOption, string][]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(hasFilters || hasQuery) && (
        <p className="type-small text-[var(--text-muted)]">
          {[current.q, current.destination, current.theme, current.product_line]
            .filter(Boolean)
            .join(" · ")}{" "}
          조건에 맞는 상품 {totalCount}개
        </p>
      )}

      {hasFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold text-[var(--text-muted)]">적용 필터</span>
          {current.destination && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] pl-2.5 pr-1.5 py-1 text-xs">
              <span className="text-[var(--foreground)]">지역: {current.destination}</span>
              <button
                type="button"
                onClick={() => removeFilter("destination")}
                className="rounded-full p-0.5 hover:bg-[var(--surface)]"
                aria-label="지역 필터 제거"
              >
                ×
              </button>
            </span>
          )}
          {current.theme && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] pl-2.5 pr-1.5 py-1 text-xs">
              <span className="text-[var(--foreground)]">테마: {current.theme}</span>
              <button
                type="button"
                onClick={() => removeFilter("theme")}
                className="rounded-full p-0.5 hover:bg-[var(--surface)]"
                aria-label="테마 필터 제거"
              >
                ×
              </button>
            </span>
          )}
          {current.product_line && (
            <span className="inline-flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface-muted)] pl-2.5 pr-1.5 py-1 text-xs">
              <span className="text-[var(--foreground)]">상품군: {current.product_line}</span>
              <button
                type="button"
                onClick={() => removeFilter("product_line")}
                className="rounded-full p-0.5 hover:bg-[var(--surface)]"
                aria-label="상품군 필터 제거"
              >
                ×
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
