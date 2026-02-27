"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import HeaderSearchDropdown from "@/components/HeaderSearchDropdown";

type HeaderProductSearchProps = {
  searchQuery?: string;
  mode: "desktop" | "mobile";
};

type ProductSuggestion = {
  id: string;
  title: string;
  category: string;
  theme: string;
};

type RecommendedKeyword = {
  id: string;
  keyword: string;
};

export default function HeaderProductSearch({ searchQuery, mode }: HeaderProductSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(searchQuery ?? "");
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [recommended, setRecommended] = useState<RecommendedKeyword[]>([]);
  const [isLoadingRecommended, setIsLoadingRecommended] = useState(false);
  const [recommendedLoaded, setRecommendedLoaded] = useState(false);
  const desktopInputRef = useRef<HTMLInputElement | null>(null);
  const mobileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const trimmedQuery = useMemo(() => query.trim(), [query]);

  // 로컬 최근 검색어 로드
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

  // 제품 제안 API
  useEffect(() => {
    if (!trimmedQuery) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/products/suggestions?q=${encodeURIComponent(trimmedQuery)}`);
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const result = (await response.json()) as { suggestions?: ProductSuggestion[] };
        setSuggestions(result.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 180);

    return () => clearTimeout(timer);
  }, [trimmedQuery]);

  // 추천 검색어 API (focus 시 최초 1회)
  useEffect(() => {
    if (!isFocused || recommendedLoaded) return;
    let cancelled = false;
    async function loadRecommended() {
      try {
        setIsLoadingRecommended(true);
        const response = await fetch("/api/search/recommended", { cache: "no-store" });
        if (!response.ok) {
          console.error("Failed to load recommended keywords");
          return;
        }
        const result = (await response.json()) as { items?: RecommendedKeyword[] };
        if (!cancelled && Array.isArray(result.items)) {
          setRecommended(result.items);
          setRecommendedLoaded(true);
        }
      } catch (error) {
        console.error("Error loading recommended keywords", error);
      } finally {
        if (!cancelled) {
          setIsLoadingRecommended(false);
        }
      }
    }
    loadRecommended();
    return () => {
      cancelled = true;
    };
  }, [isFocused, recommendedLoaded]);

  // ESC로 드롭다운 닫기
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsFocused(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    performSearch(query);
  }

  function handleSelectSuggestion(value: string) {
    performSearch(value);
  }

  const showDropdown = isFocused;

  if (mode === "desktop") {
  return (
      <form
        onSubmit={handleSubmit}
        ref={formRef}
        className="relative hidden lg:flex w-full max-w-xl"
      >
        <label htmlFor="header-product-search-desktop" className="sr-only">
          패키지상품 검색
        </label>
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
          <input
            id="header-product-search-desktop"
            type="text"
            ref={desktopInputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 120)}
            placeholder="지역/코스/상품명을 검색하세요 (예: 동남아 골프, 유럽 여행)"
            className="h-12 w-full rounded-full border border-white/10 bg-white/5 pl-10 pr-10 text-sm text-white outline-none transition-colors duration-150 placeholder:text-white/40 focus:border-[rgba(59,130,246,0.4)] focus:ring-2 focus:ring-[rgba(59,130,246,0.3)]"
            autoComplete="off"
          />
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                desktopInputRef.current?.focus();
              }}
              aria-label="검색어 지우기"
              className="absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/50 transition-colors duration-150 hover:bg-white/10 hover:text-white/85"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <HeaderSearchDropdown
          open={showDropdown}
          query={query}
          recentSearches={recentSearches}
          recommended={recommended}
          isLoadingRecommended={isLoadingRecommended}
          productSuggestions={suggestions}
          onSelectKeyword={handleSelectSuggestion}
        />
      </form>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      ref={formRef}
      className="relative flex w-full lg:hidden"
    >
      <label htmlFor="header-product-search-mobile" className="sr-only">
        패키지상품 검색
      </label>
      <div className="relative w-full">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45" />
        <input
          id="header-product-search-mobile"
          type="text"
          ref={mobileInputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 120)}
          placeholder="지역/코스/상품명을 검색하세요 (예: 동남아 골프, 유럽 여행)"
          className="h-11 w-full rounded-full border border-white/10 bg-white/5 pl-9 pr-9 text-[14px] text-white outline-none transition-colors duration-150 placeholder:text-white/40 focus:border-[rgba(59,130,246,0.4)] focus:ring-2 focus:ring-[rgba(59,130,246,0.3)]"
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              mobileInputRef.current?.focus();
            }}
            aria-label="검색어 지우기"
            className="absolute right-3 top-1/2 inline-flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-white/50 transition-colors duration-150 hover:bg-white/10 hover:text-white/85"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <HeaderSearchDropdown
        open={showDropdown}
        query={query}
        recentSearches={recentSearches}
        recommended={recommended}
        isLoadingRecommended={isLoadingRecommended}
        productSuggestions={suggestions}
        onSelectKeyword={handleSelectSuggestion}
      />
    </form>
  );
}
