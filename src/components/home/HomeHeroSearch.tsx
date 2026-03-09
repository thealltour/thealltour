"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import HeaderSearchDropdown from "@/components/HeaderSearchDropdown";

const DEFAULT_PLACEHOLDER = "지역, 테마, 상품명을 검색해보세요 (예: 일본 골프, 남미 여행)";

type ProductSuggestion = {
  id: string;
  title: string;
  category?: string;
  theme?: string;
};

type RecommendedKeyword = {
  id: string;
  keyword: string;
};

type HomeHeroSearchProps = {
  placeholder?: string | null;
};

export function HomeHeroSearch({ placeholder }: HomeHeroSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<RecommendedKeyword[]>([]);
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(false);
  const [recommendedLoaded, setRecommendedLoaded] = useState(false);
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const displayPlaceholder = placeholder?.trim() || DEFAULT_PLACEHOLDER;

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("thealltour_recent_searches_v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) {
        const normalized = parsed.filter((item) => typeof item === "string") as string[];
        setRecentSearches(normalized.slice(0, 10));
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!trimmedQuery) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/products/suggestions?q=${encodeURIComponent(trimmedQuery)}`);
        if (!res.ok) return;
        const result = (await res.json()) as { suggestions?: ProductSuggestion[] };
        setSuggestions(result.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [trimmedQuery]);

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
      if (e.key === "Escape") setIsFocused(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function pushRecentSearch(value: string) {
    if (!value.trim()) return;
    setRecentSearches((prev) => {
      const filtered = prev.filter((item) => item !== value);
      const next = [value, ...filtered].slice(0, 10);
      if (typeof window !== "undefined") {
        window.localStorage.setItem("thealltour_recent_searches_v1", JSON.stringify(next));
      }
      return next;
    });
  }

  function performSearch(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    setQuery(trimmed);
    pushRecentSearch(trimmed);
    setIsFocused(false);
    router.push(`/products?q=${encodeURIComponent(trimmed)}`);
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;

    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.search_submit,
        source: ANALYTICS_SOURCES.header_search_desktop,
        query: trimmed,
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("desktop"),
      }),
    );

    performSearch(query);
  }

  function handleSelectKeyword(value: string) {
    performSearch(value);
  }

  const showDropdown = isFocused;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="relative mx-auto w-full max-w-[720px]"
      role="search"
      aria-label="상품 검색"
    >
      <div className="flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-4 py-2 shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition focus-within:border-[var(--primary)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)] sm:px-5 sm:py-2.5">
        <Search className="h-5 w-5 shrink-0 text-[var(--text-muted)]" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 120)}
          placeholder={displayPlaceholder}
          className="min-h-10 flex-1 bg-transparent text-base text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] sm:min-h-12 sm:text-[15px]"
          autoComplete="off"
          aria-label="검색어"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 sm:px-6 sm:py-3 sm:text-base"
        >
          검색
        </button>
      </div>
      <HeaderSearchDropdown
        open={showDropdown}
        mode="desktop"
        query={query}
        recentSearches={recentSearches}
        recommended={recommended}
        isLoadingRecommended={isLoadingRecommended}
        productSuggestions={suggestions}
        onSelectKeyword={handleSelectKeyword}
      />
    </form>
  );
}
