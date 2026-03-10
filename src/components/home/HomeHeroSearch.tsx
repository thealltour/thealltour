"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { useDebounce } from "@/hooks/useDebounce";
import HeaderSearchDropdown from "@/components/HeaderSearchDropdown";
import SearchSuggestionsDropdown from "@/components/search/SearchSuggestionsDropdown";
import { cn } from "@/lib/cn";
import type { SearchSuggestion } from "@/types/search";

const HERO_RECENT_KEY = "hero_recent_searches";
const MAX_RECENT = 5;
const DEBOUNCE_MS = 250;

const DEFAULT_PLACEHOLDER =
  "지역, 테마, 상품명을 검색해보세요 (예: 일본 골프, 남미 여행, 태국 휴양)";

type RecommendedKeyword = {
  id: string;
  keyword: string;
};

type HomeHeroSearchProps = {
  placeholder?: string | null;
  /** 모바일 뷰에서 검색창 아래 '최근 검색어' 칩 블록 미노출 (PR22: 검색 중심 Hero) */
  hideRecentSearchesOnMobile?: boolean;
  /** hero-mobile: 모바일에서 full width, 라운드·시인성 강화 */
  variant?: "default" | "hero-mobile";
};

function saveRecentSearch(keyword: string) {
  if (typeof window === "undefined") return;
  try {
    const stored = JSON.parse(window.localStorage.getItem(HERO_RECENT_KEY) || "[]") as string[];
    const updated = [keyword, ...stored.filter((k) => k !== keyword)].slice(0, MAX_RECENT);
    window.localStorage.setItem(HERO_RECENT_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

function loadRecentSearches(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HERO_RECENT_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string").slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function HomeHeroSearch({ placeholder, hideRecentSearchesOnMobile = false, variant = "default" }: HomeHeroSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<RecommendedKeyword[]>([]);
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(false);
  const [recommendedLoaded, setRecommendedLoaded] = useState(false);
  const [autoSuggestions, setAutoSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastFetchRef = useRef<string>("");
  const impressionTrackedRef = useRef<string | null>(null);
  const submitSourceRef = useRef<"button" | "enter">("enter");

  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const debouncedQuery = useDebounce(trimmedQuery, DEBOUNCE_MS);
  const displayPlaceholder = placeholder?.trim() || DEFAULT_PLACEHOLDER;

  const showAutosuggest = isFocused && trimmedQuery.length >= 2;
  const showRecentRecommended = isFocused && trimmedQuery.length < 2;

  useEffect(() => {
    setRecentSearches(loadRecentSearches());
  }, []);

  useEffect(() => {
    if (!showAutosuggest) {
      setAutoSuggestions([]);
      setHighlightedIndex(-1);
      impressionTrackedRef.current = null;
      return;
    }
    if (debouncedQuery.length < 2) {
      setAutoSuggestions([]);
      setHighlightedIndex(-1);
      return;
    }

    const reqId = debouncedQuery;
    lastFetchRef.current = reqId;
    setIsLoadingSuggestions(true);
    setAutoSuggestions([]);
    setHighlightedIndex(-1);

    fetch(`/api/search/suggestions?q=${encodeURIComponent(debouncedQuery)}`)
      .then((res) => res.json())
      .then((data: { suggestions?: SearchSuggestion[] }) => {
        if (lastFetchRef.current !== reqId) return;
        const list = data.suggestions ?? [];
        setAutoSuggestions(list);
        setHighlightedIndex(list.length > 0 ? 0 : -1);
        if (list.length > 0 && impressionTrackedRef.current !== reqId) {
          impressionTrackedRef.current = reqId;
          trackClientEvent(
            createAnalyticsPayload({
              eventName: ANALYTICS_EVENTS.hero_autosuggest_impression,
              source: ANALYTICS_SOURCES.hero_search,
              query: debouncedQuery,
              resultCount: list.length,
              pagePath: typeof window !== "undefined" ? window.location.pathname : null,
              deviceType: inferDeviceType("desktop"),
            }),
          );
        }
      })
      .catch(() => {
        if (lastFetchRef.current === reqId) setAutoSuggestions([]);
      })
      .finally(() => {
        if (lastFetchRef.current === reqId) setIsLoadingSuggestions(false);
      });
  }, [debouncedQuery, showAutosuggest]);

  useEffect(() => {
    if (!showAutosuggest) return;
    setHighlightedIndex((i) => {
      if (autoSuggestions.length === 0) return -1;
      return Math.max(-1, Math.min(i, autoSuggestions.length - 1));
    });
  }, [autoSuggestions.length, showAutosuggest]);

  useEffect(() => {
    if (!isFocused || recommendedLoaded) return;
    let cancelled = false;
    async function load() {
      try {
        setIsLoadingRecommended(true);
        const res = await fetch("/api/search/recommended", { cache: "no-store" });
        if (!res.ok) return;
        const result = (await res.json()) as { items?: { id: string; keyword: string }[] };
        if (!cancelled && Array.isArray(result.items)) {
          setRecommended(result.items);
          setRecommendedLoaded(true);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setIsLoadingRecommended(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [isFocused, recommendedLoaded]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsFocused(false);
        setHighlightedIndex(-1);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleSearch = useCallback(
    (submitSource: "button" | "enter" | "suggestion") => {
      if (!trimmedQuery) return;
      saveRecentSearch(trimmedQuery);
      setRecentSearches(loadRecentSearches());
      setIsFocused(false);
      setHighlightedIndex(-1);
      setAutoSuggestions([]);

      trackClientEvent(
        createAnalyticsPayload({
          eventName: ANALYTICS_EVENTS.hero_search_submit,
          source: ANALYTICS_SOURCES.hero_search,
          query: trimmedQuery,
          section: submitSource,
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          deviceType: inferDeviceType("desktop"),
        }),
      );
      trackClientEvent(
        createAnalyticsPayload({
          eventName: ANALYTICS_EVENTS.hero_search,
          source: ANALYTICS_SOURCES.hero_search,
          query: trimmedQuery,
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          deviceType: inferDeviceType("desktop"),
        }),
      );

      router.push(`/search?q=${encodeURIComponent(trimmedQuery)}`);
    },
    [trimmedQuery, router],
  );

  const handleSelectSuggestion = useCallback(
    (item: SearchSuggestion, index: number) => {
      saveRecentSearch(item.label);
      setRecentSearches(loadRecentSearches());
      setIsFocused(false);
      setQuery("");
      setHighlightedIndex(-1);
      setAutoSuggestions([]);

      trackClientEvent(
        createAnalyticsPayload({
          eventName: ANALYTICS_EVENTS.hero_autosuggest_click,
          source: ANALYTICS_SOURCES.hero_search,
          query: trimmedQuery,
          section: item.type,
          label: item.label,
          position: index,
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          deviceType: inferDeviceType("desktop"),
        }),
      );
      trackClientEvent(
        createAnalyticsPayload({
          eventName: ANALYTICS_EVENTS.hero_search_submit,
          source: ANALYTICS_SOURCES.hero_search,
          query: trimmedQuery,
          section: "suggestion",
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          deviceType: inferDeviceType("desktop"),
        }),
      );
      trackClientEvent(
        createAnalyticsPayload({
          eventName: ANALYTICS_EVENTS.hero_search,
          source: ANALYTICS_SOURCES.hero_search,
          query: trimmedQuery,
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          deviceType: inferDeviceType("desktop"),
        }),
      );

      router.push(item.href);
    },
    [trimmedQuery, router],
  );

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (showAutosuggest && highlightedIndex >= 0 && autoSuggestions[highlightedIndex]) {
      handleSelectSuggestion(autoSuggestions[highlightedIndex], highlightedIndex);
      return;
    }
    const source = submitSourceRef.current;
    submitSourceRef.current = "enter";
    handleSearch(source);
  }

  function handleSelectKeyword(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    saveRecentSearch(trimmed);
    setRecentSearches(loadRecentSearches());
    setIsFocused(false);
    router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") submitSourceRef.current = "enter";
    if (!showAutosuggest || autoSuggestions.length === 0) {
      if (e.key === "Enter") {
        e.preventDefault();
        handleSearch("enter");
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightedIndex((i) => (i < autoSuggestions.length - 1 ? i + 1 : i));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightedIndex((i) => (i > 0 ? i - 1 : -1));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (highlightedIndex >= 0 && autoSuggestions[highlightedIndex]) {
        handleSelectSuggestion(autoSuggestions[highlightedIndex], highlightedIndex);
      } else {
        handleSearch("enter");
      }
      return;
    }
  }

  return (
    <div className="space-y-2">
      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className={cn(
          "relative mx-auto w-full",
          variant === "hero-mobile" ? "max-w-full md:max-w-[720px]" : "max-w-[720px]",
        )}
        role="search"
        aria-label="상품 검색"
      >
        <div
          className={cn(
            "flex items-center gap-2 border border-[var(--border)] bg-[var(--surface)] px-4 py-2 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] sm:px-5 sm:py-2.5",
            variant === "hero-mobile"
              ? "rounded-2xl sm:rounded-[1.25rem] md:rounded-full"
              : "rounded-full",
          )}
        >
          <Search className="h-5 w-5 shrink-0 text-[var(--text-muted)] md:h-5 md:w-5" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 180)}
            placeholder={displayPlaceholder}
            className={cn(
              "min-h-10 flex-1 bg-transparent text-base text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] sm:min-h-12 sm:text-[15px]",
              variant === "hero-mobile" && "min-h-11 sm:min-h-12",
            )}
            autoComplete="off"
            aria-label="검색어"
            aria-autocomplete="list"
            aria-controls="hero-autosuggest-list"
            aria-expanded={showAutosuggest}
            aria-activedescendant={
              highlightedIndex >= 0 && autoSuggestions[highlightedIndex]
                ? `hero-suggestion-${highlightedIndex}`
                : undefined
            }
          />
          <button
            type="submit"
            onMouseDown={() => (submitSourceRef.current = "button")}
            className={cn(
              "shrink-0 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 sm:px-6 sm:py-3 sm:text-base",
              variant === "hero-mobile" && "px-4 py-2.5 sm:px-6 sm:py-3",
            )}
          >
            검색
          </button>
        </div>

        {showAutosuggest && (
          <SearchSuggestionsDropdown
            open
            suggestions={autoSuggestions}
            highlightedIndex={highlightedIndex}
            isLoading={isLoadingSuggestions}
            query={trimmedQuery}
            onSelect={handleSelectSuggestion}
            onMouseEnterItem={setHighlightedIndex}
          />
        )}

        {showRecentRecommended && (
          <HeaderSearchDropdown
            open
            mode="desktop"
            query={query}
            recentSearches={recentSearches}
            recommended={recommended}
            isLoadingRecommended={isLoadingRecommended}
            productSuggestions={[]}
            onSelectKeyword={handleSelectKeyword}
          />
        )}
      </form>

      {recentSearches.length > 0 && !showAutosuggest ? (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 pt-1",
            hideRecentSearchesOnMobile && "hidden md:flex",
          )}
        >
          <span className="text-[11px] font-semibold text-[var(--hero-text-secondary)]/90">
            최근 검색어
          </span>
          <div className="flex flex-wrap gap-1.5">
            {recentSearches.map((keyword) => (
              <Link
                key={keyword}
                href={`/search?q=${encodeURIComponent(keyword)}`}
                className="inline-flex items-center rounded-full border border-[var(--hero-badge-border)] bg-[var(--hero-badge-bg)]/80 px-3 py-1 text-xs text-[var(--hero-text-primary)] transition hover:bg-[var(--hero-badge-bg)]"
              >
                {keyword}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
