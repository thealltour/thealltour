"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { ProductListItem } from "@/lib/products/productListItem";
import type { SearchFilterState } from "@/types/search";
import { buildSearchQueryString } from "@/lib/search/searchQueryParams";
import SearchPagination from "@/components/search/SearchPagination";
import ProductCard from "@/components/products/ProductCard";
import { ProductCardGridSection } from "@/components/products/ProductCardGridSection";
import { productToProductCardProps } from "@/lib/productCardProps";
import { useConsultModal } from "@/components/inquiry/ConsultModal";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import type { SearchApiResponse } from "@/types/search";
import { cn } from "@/lib/cn";
import { buildProductsSearchModeHref } from "@/lib/products/productsSearchMode";
import type { ProductFiltersState } from "@/lib/productFilters";

export type ProductsSearchModeResultsProps = {
  initialItems: ProductListItem[];
  initialPage: number;
  totalPages: number;
  /** /api/search 용 (destination = region name) */
  apiQuery: SearchFilterState;
  /** /products URL용 filters */
  filters: ProductFiltersState;
};

function uniqById(products: ProductListItem[]): ProductListItem[] {
  const seen = new Set<string>();
  return products.filter((p) => {
    if (seen.has(p.id)) return false;
    seen.add(p.id);
    return true;
  });
}

function LoadMoreSkeleton() {
  return (
    <div
      className="mx-auto grid w-full max-w-[1344px] grid-cols-2 gap-2.5 sm:gap-3 md:gap-4 lg:grid-cols-3"
      aria-hidden
    >
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="aspect-[3/4] w-full animate-pulse rounded-2xl bg-[var(--surface-muted)] ring-1 ring-[var(--border)]"
        />
      ))}
    </div>
  );
}

/**
 * Search Mode 결과 — 목록과 동일한 카탈로그 세로 카드 그리드.
 */
export function ProductsSearchModeResults({
  initialItems,
  initialPage,
  totalPages,
  apiQuery,
  filters,
}: ProductsSearchModeResultsProps) {
  const router = useRouter();
  const { openModal } = useConsultModal();
  const [items, setItems] = useState<ProductListItem[]>(initialItems);
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
        query: apiQuery.q ?? null,
        section: String(page),
        label: String(nextPage),
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("desktop"),
        resultCount: totalPages,
      }),
    );
    try {
      const qs = buildSearchQueryString({ ...apiQuery, page: nextPage });
      const res = await fetch(`/api/search${qs}`);
      if (!res.ok) throw new Error("Search API error");
      const data: SearchApiResponse = await res.json();
      setItems((prev) => uniqById([...prev, ...(data.items ?? [])]));
      setPage(data.page);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, hasMore, page, apiQuery, totalPages]);

  return (
    <div className="flex flex-col gap-6">
      <section aria-label="검색 결과 상품 목록">
        <ProductCardGridSection catalogListingLayout className="w-full max-w-[1344px]">
          {items.map((product) => (
            <ProductCard
              key={product.id}
              {...productToProductCardProps(product, {
                layout: "catalog",
                analyticsSource: "product_list",
                analyticsSection: "search",
                onClickDetail: () => router.push(`/products/${product.id}`),
                onClickConsult: () =>
                  openModal({
                    productId: product.id,
                    productTitle: product.title,
                    sourcePath:
                      typeof window !== "undefined"
                        ? `${window.location.pathname}${window.location.search}`
                        : "/products",
                  }),
                campaignBadgeMax: 2,
                campaignPresentationKind: "list",
              })}
            />
          ))}
        </ProductCardGridSection>
      </section>

      {totalPages > 1 && hasMore && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={isLoading}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--surface)] px-6 py-2.5 type-btn font-semibold text-[var(--foreground)] transition",
              isLoading ? "cursor-not-allowed opacity-70" : "hover:bg-[var(--surface-muted)]",
            )}
            aria-busy={isLoading}
          >
            {isLoading ? (
              <>
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--border)] border-t-[var(--primary)]"
                  aria-hidden
                />
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
          query={apiQuery}
          buildPageHref={(p) => buildProductsSearchModeHref(filters, p)}
        />
      )}
    </div>
  );
}
