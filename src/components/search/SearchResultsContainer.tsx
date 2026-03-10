"use client";

import { useState, useCallback } from "react";
import type { Product } from "@/types/product";
import type { SearchFilterState } from "@/types/search";
import { buildSearchQueryString } from "@/lib/search/searchQueryParams";
import SearchResults from "@/components/search/SearchResults";
import SearchPagination from "@/components/search/SearchPagination";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import type { SearchApiResponse } from "@/types/search";
import { cn } from "@/lib/cn";

export type SearchResultsContainerProps = {
  initialItems: Product[];
  initialPage: number;
  totalPages: number;
  query: SearchFilterState;
};

function uniqById(products: Product[]): Product[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

/** Load More 시 결과 하단에 표시할 카드 스켈레톤 */
function LoadMoreSkeleton() {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      )}
      aria-hidden
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="flex flex-col overflow-hidden rounded-2xl bg-[var(--surface)] ring-1 ring-[var(--border)]"
        >
          <div className="aspect-[16/10] w-full animate-pulse bg-[var(--surface-muted)]" />
          <div className="flex flex-1 flex-col gap-2 p-4">
            <div className="h-4 w-full animate-pulse rounded bg-[var(--border)]" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--border)]" />
            <div className="mt-2 h-5 w-24 animate-pulse rounded bg-[var(--border)]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SearchResultsContainer({
  initialItems,
  initialPage,
  totalPages,
  query,
}: SearchResultsContainerProps) {
  const [items, setItems] = useState<Product[]>(initialItems);
  const [page, setPage] = useState(initialPage);
  const [isLoading, setIsLoading] = useState(false);
  const hasMore = page < totalPages;

  const loadMore = useCallback(async () => {
    if (isLoading || !hasMore) return;
    const nextPage = page + 1;
    setIsLoading(true);
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.search_load_more_click,
        source: ANALYTICS_SOURCES.hero_search,
        query: query.q ?? null,
        section: String(page),
        label: String(nextPage),
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("desktop"),
        resultCount: totalPages,
      }),
    );
    try {
      const apiQuery = { ...query, page: nextPage };
      const qs = buildSearchQueryString(apiQuery);
      const res = await fetch(`/api/search${qs}`);
      if (!res.ok) throw new Error("Search API error");
      const data: SearchApiResponse = await res.json();
      setItems((prev) => uniqById([...prev, ...(data.items ?? [])]));
      setPage(data.page);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, page, query, totalPages]);

  return (
    <div className="flex flex-col gap-6">
      <SearchResults products={items} />

      {totalPages > 1 && hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoading}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-6 py-2.5 type-btn font-semibold text-[var(--foreground)] transition",
              isLoading
                ? "cursor-not-allowed opacity-70"
                : "hover:bg-[var(--surface-muted)]",
            )}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]" aria-hidden />
                <span>불러오는 중...</span>
              </>
            ) : (
              "더 많은 상품 보기"
            )}
          </button>
        </div>
      )}

      {isLoading && <LoadMoreSkeleton />}

      {totalPages > 1 && (
        <SearchPagination
          currentPage={page}
          totalPages={totalPages}
          query={query}
        />
      )}
    </div>
  );
}
