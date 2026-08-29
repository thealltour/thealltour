"use client";

import Link from "next/link";
import type { SearchFilterState } from "@/types/search";
import { buildSearchUrl } from "@/lib/search/searchQueryParams";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { cn } from "@/lib/cn";
import { solidButtonShadowClasses } from "@/components/ui/Button";

export type SearchPaginationProps = {
  currentPage: number;
  totalPages: number;
  query: SearchFilterState;
  /** 기본: /search URL. Search Mode(/products)·Browse에서는 커스텀 href */
  buildPageHref?: (page: number) => string;
  /** Search pagination click analytics. Browse는 false. */
  trackAnalytics?: boolean;
  /** nav aria-label */
  ariaLabel?: string;
};

const MAX_VISIBLE = 7;

/** min 44px touch target (mobile-first) */
const PAGE_CONTROL =
  "inline-flex h-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg px-2 type-small";

/**
 * totalPages > 7 이면 1 ... mid-1 mid mid+1 ... last 형태.
 */
export function getSearchPaginationPageNumbers(
  currentPage: number,
  totalPages: number,
): (number | "ellipsis")[] {
  if (totalPages <= MAX_VISIBLE) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  const pages: (number | "ellipsis")[] = [];
  pages.push(1);
  const left = Math.max(2, currentPage - 1);
  const right = Math.min(totalPages - 1, currentPage + 1);
  if (left > 2) pages.push("ellipsis");
  for (let p = left; p <= right; p++) {
    if (p !== 1 && p !== totalPages) pages.push(p);
  }
  if (right < totalPages - 1) pages.push("ellipsis");
  if (totalPages > 1) pages.push(totalPages);
  return pages;
}

export default function SearchPagination({
  currentPage,
  totalPages,
  query,
  buildPageHref,
  trackAnalytics = true,
  ariaLabel = "검색 결과 페이지 이동",
}: SearchPaginationProps) {
  const pages = getSearchPaginationPageNumbers(currentPage, totalPages);

  const trackPagination = (fromPage: number, toPage: number) => {
    if (!trackAnalytics) return;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.search_pagination_click,
        source: ANALYTICS_SOURCES.hero_search,
        query: query.q ?? null,
        section: String(fromPage),
        label: String(toPage),
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("desktop"),
        resultCount: totalPages,
      }),
    );
  };

  const hrefForPage = (p: number) =>
    buildPageHref ? buildPageHref(p) : buildSearchUrl({ ...query, page: p });

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-1 sm:gap-2"
      aria-label={ariaLabel}
    >
      <span className="sr-only">
        총 {totalPages}페이지 중 {currentPage}페이지
      </span>
      {currentPage <= 1 ? (
        <span
          className={cn(
            PAGE_CONTROL,
            "cursor-not-allowed border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
          )}
          aria-disabled="true"
        >
          이전
        </span>
      ) : (
        <Link
          href={hrefForPage(currentPage - 1)}
          className={cn(
            PAGE_CONTROL,
            "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]",
          )}
          onClick={() => trackPagination(currentPage, currentPage - 1)}
        >
          이전
        </Link>
      )}

      <div className="flex items-center gap-1">
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span key={`ellipsis-${i}`} className="px-1 type-small text-[var(--text-muted)]" aria-hidden>
              …
            </span>
          ) : (
            <span key={p}>
              {p === currentPage ? (
                <span
                  className={cn(
                    PAGE_CONTROL,
                    "border-2 border-[var(--primary)] bg-[var(--primary)] font-semibold text-[var(--on-primary)]",
                    solidButtonShadowClasses,
                  )}
                  aria-current="page"
                >
                  {p}
                </span>
              ) : (
                <Link
                  href={hrefForPage(p)}
                  className={cn(
                    PAGE_CONTROL,
                    "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]",
                  )}
                  onClick={() => trackPagination(currentPage, p)}
                >
                  {p}
                </Link>
              )}
            </span>
          ),
        )}
      </div>

      {currentPage >= totalPages ? (
        <span
          className={cn(
            PAGE_CONTROL,
            "cursor-not-allowed border border-[var(--border)] bg-[var(--surface-muted)] text-[var(--text-muted)]",
          )}
          aria-disabled="true"
        >
          다음
        </span>
      ) : (
        <Link
          href={hrefForPage(currentPage + 1)}
          className={cn(
            PAGE_CONTROL,
            "border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]",
          )}
          onClick={() => trackPagination(currentPage, currentPage + 1)}
        >
          다음
        </Link>
      )}
    </nav>
  );
}
