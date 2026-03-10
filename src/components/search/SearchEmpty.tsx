"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import type { SearchFilterState } from "@/types/search";
import { buildSearchUrl, updateSearchQueryParams, withPageOne } from "@/lib/search/searchQueryParams";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export type SearchEmptyProps = {
  /** 현재 검색어 */
  keyword?: string;
  /** 적용된 필터 요약 */
  current: SearchFilterState;
};

export default function SearchEmpty({ keyword, current }: SearchEmptyProps) {
  const router = useRouter();
  const trackedRef = useRef(false);
  const hasFilters = Boolean(current.destination || current.theme || current.product_line);

  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.search_no_result,
        source: ANALYTICS_SOURCES.hero_search,
        query: current.q ?? null,
        resultCount: 0,
        section: current.destination ?? null,
        label: [current.destination, current.theme, current.product_line].filter(Boolean).join(",") || null,
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("desktop"),
      }),
    );
  }, [current.q, current.destination, current.theme, current.product_line]);

  const resetUrl = keyword
    ? buildSearchUrl(withPageOne(updateSearchQueryParams(current, { destination: "", theme: "", product_line: "" })))
    : "/search";

  const handleReset = () => {
    router.push(resetUrl);
  };

  return (
    <div className="rounded-2xl bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:rounded-3xl">
      <p className="font-semibold text-[var(--text-primary)]">검색 결과가 없습니다.</p>
      <p className="mt-2 type-small text-[var(--text-muted)]">
        {keyword
          ? `"${keyword}"와 일치하는 상품을 찾지 못했습니다.`
          : "조건에 맞는 상품이 없습니다."}
      </p>
      <p className="mt-1 text-[11px] text-[var(--text-muted)]">
        검색어를 더 짧게 입력하거나 다른 지역/테마로 다시 탐색해보세요.
      </p>
      {hasFilters && (
        <p className="mt-1 text-[11px] text-[var(--text-muted)]">
          적용한 필터를 초기화해 더 많은 상품을 볼 수 있습니다.
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        {hasFilters && (
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 type-btn font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
          >
            필터 초기화
          </button>
        )}
        <Link
          href="/destinations"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 type-btn font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
        >
          인기 여행지
        </Link>
        <Link
          href="/themes"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 type-btn font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
        >
          테마별 여행
        </Link>
        <Link
          href="/recommended"
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 py-2 type-btn font-semibold text-[var(--on-primary)] transition hover:opacity-90"
        >
          추천 여행
        </Link>
      </div>
    </div>
  );
}
