"use client";

import Link from "next/link";
import type { SearchFilterState } from "@/types/search";
import { buildSearchUrl } from "@/lib/search/searchQueryParams";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { cn } from "@/lib/cn";

export type SearchPaginationProps = {
  currentPage: number;
  totalPages: number;
  query: SearchFilterState;
};

const MAX_VISIBLE = 7;

/**
 * totalPages > 7 이면 1 ... mid-1 mid mid+1 ... last 형태.
 */
function getPageNumbers(currentPage: number, totalPages: number): (number | "ellipsis")[] {
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

export default function SearchPagination({ currentPage, totalPages, query }: SearchPaginationProps) {
  const pages = getPageNumbers(currentPage, totalPages);

  const trackPagination = (fromPage: number, toPage: number) => {
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

  const hrefForPage = (p: number) => buildSearchUrl({ ...query, page: p });

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-1 sm:gap-2"
      aria-label="검색 결과 페이지 이동"
    >
      <span className="sr-only">
        총 {totalPages}페이지 중 {currentPage}페이지
      </span>
      {/* 이전 */}
      {currentPage <= 1 ? (
        <span
          className="inline-flex h-9 min-w-[2.25rem] cursor-not-allowed items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 text-[var(--text-muted)]"
          aria-disabled="true"
        >
          이전
        </span>
      ) : (
        <Link
          href={hrefForPage(currentPage - 1)}
          className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 type-small text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
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
                  className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border-2 border-[var(--primary)] bg-[var(--primary)] px-2 type-small font-semibold text-[var(--on-primary)]"
                  aria-current="page"
                >
                  {p}
                </span>
              ) : (
                <Link
                  href={hrefForPage(p)}
                  className={cn(
                    "inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 type-small text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]",
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

      {/* 다음 */}
      {currentPage >= totalPages ? (
        <span
          className="inline-flex h-9 min-w-[2.25rem] cursor-not-allowed items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-2 text-[var(--text-muted)]"
          aria-disabled="true"
        >
          다음
        </span>
      ) : (
        <Link
          href={hrefForPage(currentPage + 1)}
          className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 type-small text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
          onClick={() => trackPagination(currentPage, currentPage + 1)}
        >
          다음
        </Link>
      )}
    </nav>
  );
}
