import type { MouseEvent } from "react";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

type RecommendedKeyword = {
  id: string;
  keyword: string;
};

type ProductSuggestionItem = {
  id: string;
  title: string;
  category?: string;
  theme?: string;
};

type HeaderSearchDropdownProps = {
  open: boolean;
  mode: "desktop" | "mobile";
  query: string;
  recentSearches: string[];
  recommended: RecommendedKeyword[];
  isLoadingRecommended: boolean;
  productSuggestions: ProductSuggestionItem[];
  onSelectKeyword: (value: string) => void;
};

export default function HeaderSearchDropdown({
  open,
  mode,
  query,
  recentSearches,
  recommended,
  isLoadingRecommended,
  productSuggestions,
  onSelectKeyword,
}: HeaderSearchDropdownProps) {
  const searchSource =
    mode === "desktop" ? ANALYTICS_SOURCES.header_search_desktop : ANALYTICS_SOURCES.header_search_mobile;

  function trackSearchClick(
    eventName: "search_recent_click" | "search_recommended_click" | "search_suggestion_click",
    value: string,
  ) {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS[eventName],
        source: searchSource,
        query: query.trim() || null,
        label: value,
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType(mode),
      }),
    );
  }

  function handleClickRecent(event: MouseEvent<HTMLButtonElement>, value: string) {
    event.preventDefault();
    trackSearchClick("search_recent_click", value);
    onSelectKeyword(value);
  }

  function handleClickRecommended(event: MouseEvent<HTMLButtonElement>, value: string) {
    event.preventDefault();
    trackSearchClick("search_recommended_click", value);
    onSelectKeyword(value);
  }

  function handleClickSuggestion(event: MouseEvent<HTMLButtonElement>, value: string) {
    event.preventDefault();
    trackSearchClick("search_suggestion_click", value);
    onSelectKeyword(value);
  }

  if (
    !open ||
    (!recentSearches.length &&
      !recommended.length &&
      !productSuggestions.length &&
      !isLoadingRecommended)
  ) {
    return null;
  }

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] text-[var(--foreground)] shadow-[var(--shadow-modal)]">
        {/* 최근 검색어 섹션 */}
        {recentSearches.length > 0 ? (
          <section className="px-3 py-2.5">
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-[var(--text-muted)]">
              <span>최근 검색어</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {recentSearches.slice(0, 8).map((keyword) => (
                <button
                  key={keyword}
                  type="button"
                  onMouseDown={(event) => handleClickRecent(event, keyword)}
                  className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1 text-xs text-[var(--foreground)] transition hover:bg-[var(--surface)] hover:border-[var(--border-strong)]"
                >
                  {keyword}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* 추천 검색어 섹션 */}
        {isLoadingRecommended ? (
          <section className="border-t border-[var(--divider)] px-3 py-2.5">
            <p className="mb-1 text-[11px] font-semibold text-[var(--text-muted)]">
              추천 검색어
            </p>
            <div className="space-y-1.5">
              <div className="h-3 w-32 rounded bg-[var(--border)]/70 animate-pulse" />
              <div className="h-3 w-40 rounded bg-[var(--border)]/60 animate-pulse" />
            </div>
          </section>
        ) : recommended.length > 0 ? (
          <section className="border-t border-[var(--divider)] px-3 py-2.5">
            <p className="mb-1 text-[11px] font-semibold text-[var(--text-muted)]">
              추천 검색어
            </p>
            <div className="flex flex-wrap gap-1.5">
              {recommended.slice(0, 10).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onMouseDown={(event) => handleClickRecommended(event, item.keyword)}
                  className="inline-flex items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1 text-xs text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                >
                  {item.keyword}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {/* 상품 제안 섹션 */}
        {productSuggestions.length > 0 ? (
          <section className="border-t border-[var(--divider)]">
            <p className="px-3 pt-2 text-[11px] font-semibold text-[var(--text-muted)]">
              검색 제안
            </p>
            <ul className="max-h-64 overflow-y-auto px-1 pb-1.5 pt-1">
              {productSuggestions.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => handleClickSuggestion(event, item.title)}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
                  >
                    <span className="line-clamp-1 text-sm font-medium">
                      {item.title}
                    </span>
                    {(item.category || item.theme) && (
                      <span className="ml-3 shrink-0 text-[11px] text-[var(--text-muted)]">
                        {item.theme ? `${item.category} · ${item.theme}` : item.category}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* 검색어 없을 때 안내 */}
        {!recentSearches.length &&
          !recommended.length &&
          !productSuggestions.length &&
          !isLoadingRecommended && (
            <div className="px-3 py-2.5 text-[11px] text-[var(--text-muted)]">
              {query
                ? "입력하신 검색어와 관련된 추천 결과가 없습니다."
                : "최근 검색어나 추천 검색어가 준비되면 이곳에 표시됩니다."}
            </div>
          )}
      </div>
    </div>
  );
}

