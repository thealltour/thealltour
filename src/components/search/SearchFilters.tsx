"use client";

import { useRouter } from "next/navigation";
import type { SearchFilterState, SearchFilterOptions } from "@/types/search";
import { buildSearchUrl, updateSearchQueryParams, withPageOne } from "@/lib/search/searchQueryParams";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export type SearchFiltersProps = {
  /** 현재 적용된 값 */
  current: SearchFilterState;
  /** 선택 가능한 옵션 (결과에서 파생 또는 taxonomy) */
  options: SearchFilterOptions;
};

export default function SearchFilters({ current, options }: SearchFiltersProps) {
  const router = useRouter();

  const handleChange = (
    key: "destination" | "theme" | "product_line",
    value: string,
  ) => {
    const next = withPageOne(updateSearchQueryParams(current, { [key]: value || undefined }));
    router.push(buildSearchUrl(next));
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.search_filter_change,
        source: ANALYTICS_SOURCES.hero_search,
        query: current.q ?? null,
        section: key,
        label: value || null,
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("desktop"),
      }),
    );
  };

  const hasOptions =
    options.destinations.length > 0 ||
    options.themes.length > 0 ||
    options.productLines.length > 0;

  if (!hasOptions) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <span className="text-[11px] font-semibold text-[var(--text-muted)]">필터</span>

      {options.destinations.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="search-filter-destination" className="sr-only">
            지역
          </label>
          <select
            id="search-filter-destination"
            value={current.destination ?? ""}
            onChange={(e) => handleChange("destination", e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            <option value="">지역 전체</option>
            {options.destinations.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
      )}

      {options.themes.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="search-filter-theme" className="sr-only">
            테마
          </label>
          <select
            id="search-filter-theme"
            value={current.theme ?? ""}
            onChange={(e) => handleChange("theme", e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            <option value="">테마 전체</option>
            {options.themes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      )}

      {options.productLines.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor="search-filter-product-line" className="sr-only">
            상품군
          </label>
          <select
            id="search-filter-product-line"
            value={current.product_line ?? ""}
            onChange={(e) => handleChange("product_line", e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-sm text-[var(--foreground)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
          >
            <option value="">상품군 전체</option>
            {options.productLines.map((pl) => (
              <option key={pl} value={pl}>
                {pl}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
