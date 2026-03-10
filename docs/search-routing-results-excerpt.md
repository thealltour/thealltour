# 검색/라우팅/결과 구조 발췌 (PR 요청문 작성용)

아래는 검색 결과 페이지 정교화 PR 요청문 작성을 위해, 현재 검색·라우팅·결과 렌더링·필터 구조를 **생략 없이** 발췌한 내용입니다.  
파일 경로 → 해당 파일 **전체 코드** 순으로 정리했습니다.

---

## 1. 홈 Hero 검색 관련

### src/components/home/HeroSection.tsx

```tsx
"use client";

import Link from "next/link";
import Image from "next/image";
import { PageContainer } from "@/components/layout/PageContainer";
import { HeroRecommendedLinks } from "@/components/home/HeroRecommendedLinks";
import { HomeHeroSearch } from "@/components/home/HomeHeroSearch";
import type { HomeBanner } from "@/types/homeBanner";

export type HeroResolvedContent = {
  badge: string | null;
  main_copy_accent: string | null;
  main_copy_tail: string | null;
  sub_description: string | null;
  recommended_text: string | null;
  search_placeholder: string | null;
};

export type HeroSectionProps = {
  /** 메인 비주얼 배너 (없으면 배경만) */
  primaryBanner?: HomeBanner | null;
  /** 히어로 문구 (resolveHeroContent 결과) */
  hero: HeroResolvedContent;
};

/**
 * 홈 최상단 Hero 섹션.
 * 브랜드 메시지 + 주요 CTA(검색/추천 링크) 노출.
 * 추후 검색/비주얼 확장 시 이 컴포넌트 내부만 수정.
 */
export default function HeroSection({ primaryBanner = null, hero }: HeroSectionProps) {
  return (
    <section className="relative bg-[var(--hero-bg)]">
      {primaryBanner ? (
        <>
          <div className="pointer-events-none absolute inset-0 hidden md:block">
            <Image
              src={primaryBanner.image_url}
              alt={primaryBanner.title}
              fill
              sizes="100vw"
              priority
              fetchPriority="high"
              quality={82}
              className="object-cover object-[right_center]"
            />
            <div className="absolute inset-0 hero-scrim" />
            <div className="absolute inset-y-0 right-0 w-3/5 hero-overlay-warm mix-blend-soft-light" />
            <div className="absolute inset-y-0 left-1/2 w-[18%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--hero-scrim-from)]/40 to-transparent backdrop-blur-[2px]" />
            <div className="absolute inset-0 hero-vignette" />
          </div>
          <div className="pointer-events-none absolute inset-0 hidden md:block hero-vignette-soft" />
        </>
      ) : null}

      <PageContainer size="wide">
        <div className="relative z-10 py-6 text-[var(--hero-text-primary)] sm:py-8 md:py-10">
          <div className="space-y-4 md:space-y-5">
            {primaryBanner ? (
              <div className="overflow-hidden rounded-2xl ring-1 ring-[var(--hero-badge-border)] md:hidden">
                <div className="relative aspect-[16/11] w-full">
                  <Image
                    src={primaryBanner.mobile_image_url || primaryBanner.image_url}
                    alt={primaryBanner.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 0px"
                    priority
                    fetchPriority="high"
                    quality={82}
                    className="object-cover object-center"
                  />
                  <div className="pointer-events-none absolute inset-0 image-overlay-bottom" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 p-4 text-left text-[var(--hero-text-primary)]">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--hero-text-secondary)]/90">
                      THEALL CURATION
                    </p>
                    <p className="mt-1 type-small font-semibold">{primaryBanner.title}</p>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-6 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1.05fr)] md:items-center">
              <div className="space-y-4">
                <p className="inline-flex items-center gap-2 rounded-full bg-[var(--hero-badge-bg)] px-4 py-1 section-label text-[var(--hero-text-secondary)] md:type-small ring-1 ring-[var(--hero-badge-border)]">
                  {hero.badge ?? "THEALL TOUR"}
                </p>
                <h1 className="heading-display-hero type-h1 font-semibold leading-[1.15] md:text-[2.5rem]">
                  {hero.main_copy_accent ? (
                    <>
                      <span className="text-[var(--hero-accent)]">{hero.main_copy_accent}</span>
                      {hero.main_copy_tail}
                    </>
                  ) : (
                    hero.main_copy_tail?.trim() || "골프와 여행의 시작"
                  )}
                </h1>
                <p className="max-w-xl type-small font-semibold text-[var(--hero-text-secondary)] md:type-body">
                  {hero.sub_description ?? ""}
                </p>
                <div className="w-full max-w-[720px] space-y-1">
                  <div className="pt-2 md:pt-3">
                    <HomeHeroSearch placeholder={hero.search_placeholder ?? "지역, 테마, 상품명을 검색해보세요"} />
                  </div>
                  <p className="type-caption text-[var(--hero-text-secondary)]/80">
                    {hero.recommended_text ? (
                      <HeroRecommendedLinks text={hero.recommended_text} />
                    ) : (
                      <>
                        또는{" "}
                        <Link href="/destinations" className="underline hover:no-underline">
                          지역별 여행
                        </Link>
                        {" · "}
                        <Link href="/themes" className="underline hover:no-underline">
                          테마별 여행
                        </Link>
                        {" · "}
                        <Link href="/recommended" className="underline hover:no-underline">
                          추천여행
                        </Link>
                        {" 으로 탐색"}
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="hidden min-h-[160px] md:block" />
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  );
}
```

---

### src/components/home/HomeHeroSearch.tsx

(실제 홈 검색 input / autosuggest / submit 처리 파일. `HeroSearch.tsx`는 없음.)

```tsx
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

export function HomeHeroSearch({ placeholder }: HomeHeroSearchProps) {
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
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 180)}
            placeholder={displayPlaceholder}
            className="min-h-10 flex-1 bg-transparent text-base text-[var(--foreground)] outline-none placeholder:text-[var(--text-muted)] sm:min-h-12 sm:text-[15px]"
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
            className="shrink-0 rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-[var(--on-primary)] transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 sm:px-6 sm:py-3 sm:text-base"
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
        <div className="flex flex-wrap items-center gap-2 pt-1">
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
```

---

### src/components/home/HeroRecommendedLinks.tsx

```tsx
import Link from "next/link";

const PHRASES: { label: string; href: string }[] = [
  { label: "지역별 여행", href: "/destinations" },
  { label: "테마별 여행", href: "/themes" },
  { label: "추천여행", href: "/recommended" },
];

/**
 * 관리자에서 설정한 추천 탐색 문구를 표시합니다.
 * 문구 안의 "지역별 여행", "테마별 여행", "추천여행"을 해당 링크로 렌더링합니다.
 */
export function HeroRecommendedLinks({ text }: { text: string }) {
  if (!text.trim()) return null;

  let remaining = text;
  const nodes: React.ReactNode[] = [];
  let key = 0;

  for (const { label, href } of PHRASES) {
    const i = remaining.indexOf(label);
    if (i === -1) continue;
    const before = remaining.slice(0, i);
    if (before) nodes.push(<span key={key++}>{before}</span>);
    nodes.push(
      <Link key={key++} href={href} className="underline hover:no-underline">
        {label}
      </Link>,
    );
    remaining = remaining.slice(i + label.length);
  }
  if (remaining) nodes.push(<span key={key++}>{remaining}</span>);

  if (nodes.length === 0) return <>{text}</>;
  return <>{nodes}</>;
}
```

---

## 2. 검색 결과 페이지 관련

- `app/search/loading.tsx`, `app/search/error.tsx` 는 **존재하지 않습니다.**  
- 검색 결과 페이지에서 사용하는 하위 컴포넌트: `SearchResults.tsx` 만 사용.  
  `SearchFilters.tsx`, `SearchHeader.tsx`, `SearchEmpty.tsx` 는 **없으며**, 빈 결과 UI는 `SearchResults` 내부 인라인으로 처리합니다.

### src/app/search/page.tsx

```tsx
import { Suspense } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { searchProducts } from "@/lib/search/searchProducts";
import SearchResults from "@/components/search/SearchResults";
import SiteHeader from "@/components/SiteHeader";

const SEARCH_PAGE_TITLE = "검색 결과";

type SearchPageProps = {
  searchParams: Promise<{ q?: string }>;
};

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const products = q ? await searchProducts(q) : [];

  return (
    <>
      <SiteHeader />
      <div className="min-h-screen bg-[var(--theall-page-bg)] text-[var(--foreground)]">
        <main className="py-6 sm:py-10 md:py-14">
          <PageContainer size="wide" className="flex flex-col gap-6">
            <div>
              {q ? (
                <h1 className="heading-display type-h2 text-[var(--foreground)]">
                  &quot;{q}&quot; 검색 결과
                </h1>
              ) : (
                <h1 className="heading-display type-h2 text-[var(--foreground)]">
                  {SEARCH_PAGE_TITLE}
                </h1>
              )}
              {!q && (
                <p className="mt-2 type-small text-[var(--text-muted)]">
                  검색어를 입력해 주세요.
                </p>
              )}
            </div>

            <Suspense fallback={<div className="type-small text-[var(--text-muted)]">검색 중...</div>}>
              <SearchResults keyword={q} products={products} />
            </Suspense>
          </PageContainer>
        </main>
      </div>
    </>
  );
}
```

---

### src/components/search/SearchResults.tsx

```tsx
"use client";

import Link from "next/link";
import type { Product } from "@/types/product";
import ProductCardV2 from "@/components/products/ProductCardV2";
import { getProductBadges } from "@/lib/productCategory";
import { parseMetaTitleAsHashtags } from "@/lib/products/parseMetaTitleAsHashtags";
import type { ProductCardV2Status } from "@/components/products/ProductCardV2";
import { ENABLE_NEW_PRODUCT_UI } from "@/config/featureFlags";
import { cn } from "@/lib/cn";

const PRIORITY_BADGES = ["제철", "인기", "마감임박"];

function buildV2Badges(
  product: Product,
  themeBadges: string[],
): { type: string; label: string; priority?: number; isActive?: boolean }[] {
  return themeBadges.map((label) => ({
    type: PRIORITY_BADGES.includes(label) ? "gold" : "muted",
    label,
    priority: PRIORITY_BADGES.includes(label) ? 5 : 0,
    isActive: true,
  }));
}

export type SearchResultsProps = {
  keyword: string;
  products: Product[];
};

export default function SearchResults({ keyword, products }: SearchResultsProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--surface)] p-8 text-center shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] sm:rounded-3xl">
        <p className="font-semibold text-[var(--text-primary)]">검색 결과가 없습니다.</p>
        <p className="mt-2 type-small text-[var(--text-muted)]">
          &quot;{keyword}&quot;와 일치하는 상품을 찾지 못했습니다.
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/destinations"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 py-2 type-btn font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
          >
            인기 여행지
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

  if (!ENABLE_NEW_PRODUCT_UI) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {products.map((product) => (
          <Link
            key={product.id}
            href={`/products/${product.id}`}
            className="flex h-full flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--shadow-soft)] ring-1 ring-[var(--border)] transition hover:shadow-[var(--shadow-soft-strong)]"
          >
            <div className="relative aspect-[16/10] w-full bg-[var(--surface-muted)]">
              <img
                src={product.image_url}
                alt=""
                className="h-full w-full object-cover"
              />
            </div>
            <div className="flex flex-1 flex-col p-4">
              <p className="font-semibold text-[var(--foreground)] line-clamp-2">{product.title}</p>
              {typeof product.price === "number" && (
                <p className="mt-2 font-semibold text-[var(--primary)]">
                  {new Intl.NumberFormat("ko-KR").format(product.price)}원~
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    );
  }

  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
      )}
      aria-label="검색 결과 상품 목록"
    >
      {products.map((product) => {
        const badges = getProductBadges(product);
        const hashtags = parseMetaTitleAsHashtags(product.meta_title);
        const status: ProductCardV2Status = product.status ?? "AVAILABLE";
        return (
          <li key={product.id}>
            <ProductCardV2
              layout="grid"
              title={product.title}
              price={product.price}
              duration={product.duration}
              region={product.category}
              categories={[product.category]}
              tags={hashtags}
              status={status}
              badges={buildV2Badges(product, badges)}
              thumbnailUrl={product.image_url}
              priceMeta={product.price_meta ?? "1인 기준"}
              metaInfo={product.meta_info ?? ""}
              hrefDetail={`/products/${product.id}`}
              analyticsSource="product_list"
              analyticsSection="search"
              productId={product.id}
            />
          </li>
        );
      })}
    </ul>
  );
}
```

---

### src/components/search/SearchSuggestionsDropdown.tsx

(자동완성 드롭다운. Hero 검색에서만 사용, 검색 결과 페이지에서는 미사용.)

```tsx
"use client";

import type { SearchSuggestion } from "@/types/search";
import { cn } from "@/lib/cn";

const TYPE_LABELS: Record<SearchSuggestion["type"], string> = {
  destination: "지역",
  theme: "테마",
  product: "상품",
};

export type SearchSuggestionsDropdownProps = {
  open: boolean;
  suggestions: SearchSuggestion[];
  highlightedIndex: number;
  isLoading: boolean;
  query: string;
  onSelect: (suggestion: SearchSuggestion, index: number) => void;
  onMouseEnterItem: (index: number) => void;
};

export default function SearchSuggestionsDropdown({
  open,
  suggestions,
  highlightedIndex,
  isLoading,
  query,
  onSelect,
  onMouseEnterItem,
}: SearchSuggestionsDropdownProps) {
  if (!open) return null;

  if (isLoading) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-[var(--shadow-modal)]">
          <p className="text-xs text-[var(--text-muted)]">추천어를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0 && query.trim().length >= 2) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] px-4 py-3 shadow-[var(--shadow-modal)]">
          <p className="text-xs text-[var(--text-muted)]">일치하는 추천어가 없습니다.</p>
          <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
            검색어를 더 구체적으로 입력해보세요.
          </p>
        </div>
      </div>
    );
  }

  if (suggestions.length === 0) return null;

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50">
      <ul
        id="hero-autosuggest-list"
        className="max-h-[min(70vh,320px)] overflow-y-auto overflow-x-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface-elevated)] py-1 shadow-[var(--shadow-modal)]"
        role="listbox"
        aria-label="검색 추천 목록"
      >
        {suggestions.map((item, index) => (
          <li
            key={item.id}
            id={`hero-suggestion-${index}`}
            role="option"
            aria-selected={index === highlightedIndex}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item, index);
            }}
            onMouseEnter={() => onMouseEnterItem(index)}
            className={cn(
              "flex cursor-pointer items-center gap-3 px-4 py-2.5 text-left transition",
              index === highlightedIndex
                ? "bg-[var(--primary-soft)] text-[var(--foreground)]"
                : "text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
            )}
          >
            <span
              className={cn(
                "shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold",
                item.type === "destination" && "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-200",
                item.type === "theme" && "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
                item.type === "product" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
              )}
            >
              {TYPE_LABELS[item.type]}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{item.label}</p>
              {item.sublabel ? (
                <p className="truncate text-[11px] text-[var(--text-muted)]">{item.sublabel}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 3. 검색 데이터 조회 관련

### src/lib/search/searchProducts.ts

```ts
import { supabase } from "@/lib/supabase";
import { normalizeProduct } from "@/lib/products";
import type { Product } from "@/types/product";

/**
 * 검색 대상: product title, category(지역명 등), theme.
 * /search 페이지 및 Hero 검색에서 사용.
 */
export async function searchProducts(keyword: string): Promise<Product[]> {
  const q = keyword.trim();
  if (!q) return [];

  const pattern = `%${q}%`;

  const { data, error } = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .or(`title.ilike.${pattern},category.ilike.${pattern},theme.ilike.${pattern}`)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (error) {
    console.error("[search] searchProducts error:", error.message);
    return [];
  }

  return (data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>));
}
```

---

### src/lib/search/getSearchSuggestions.ts

```ts
import { supabase } from "@/lib/supabase";
import { getDestinationLandingHref, getThemeLandingHref } from "@/lib/hubLandingLinks";
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { SearchSuggestion } from "@/types/search";

const MAX_DESTINATION = 3;
const MAX_THEME = 3;
const MAX_PRODUCT = 4;

function rowToTaxonomy(row: Record<string, unknown>, taxonomyType: "destination" | "theme"): ProductTaxonomy {
  return {
    id: String(row.id ?? ""),
    taxonomy_type: taxonomyType,
    name: String(row.name ?? ""),
    slug: typeof row.slug === "string" ? row.slug : null,
    is_active: typeof row.is_active === "boolean" ? row.is_active : true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    is_hub_visible: true,
    is_landing_enabled: typeof row.is_landing_enabled === "boolean" ? row.is_landing_enabled : false,
    card_title: typeof row.card_title === "string" ? row.card_title : undefined,
    card_image_url: typeof row.card_image_url === "string" ? row.card_image_url : undefined,
  };
}

/**
 * Hero 검색 자동완성용 추천 리스트.
 * destination(지역) 최대 3, theme(테마) 최대 3, product(상품) 최대 4.
 * 클릭 시 이동할 href는 기존 허브/상세 규칙으로 생성.
 */
export async function getSearchSuggestions(keyword: string): Promise<SearchSuggestion[]> {
  const q = keyword.trim();
  if (!q || q.length < 2) return [];

  const pattern = `%${q}%`;
  const out: SearchSuggestion[] = [];

  try {
    const [destRes, themeRes, productRes] = await Promise.all([
      supabase
        .from("product_taxonomies")
        .select("id, name, slug, is_active, is_landing_enabled, card_title, card_image_url, sort_order, created_at")
        .eq("taxonomy_type", "destination")
        .eq("is_active", true)
        .ilike("name", pattern)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })
        .limit(MAX_DESTINATION),
      supabase
        .from("product_taxonomies")
        .select("id, name, slug, is_active, is_landing_enabled, card_title, card_image_url, sort_order, created_at")
        .eq("taxonomy_type", "theme")
        .eq("is_active", true)
        .ilike("name", pattern)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true })
        .limit(MAX_THEME),
      supabase
        .from("products")
        .select("id, title, image_url, category, theme")
        .eq("is_active", true)
        .ilike("title", pattern)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .limit(MAX_PRODUCT),
    ]);

    const seenLabels = new Set<string>();

    for (const row of destRes.data ?? []) {
      const r = row as Record<string, unknown>;
      const tax = rowToTaxonomy(r, "destination");
      const label = (tax.card_title ?? tax.name).trim();
      if (!label || seenLabels.has(`destination:${label}`)) continue;
      seenLabels.add(`destination:${label}`);
      out.push({
        id: `dest-${tax.id}`,
        type: "destination",
        label,
        sublabel: null,
        slug: tax.slug,
        imageUrl: tax.card_image_url ?? null,
        href: getDestinationLandingHref(tax),
      });
    }

    for (const row of themeRes.data ?? []) {
      const r = row as Record<string, unknown>;
      const tax = rowToTaxonomy(r, "theme");
      const label = (tax.card_title ?? tax.name).trim();
      if (!label || seenLabels.has(`theme:${label}`)) continue;
      seenLabels.add(`theme:${label}`);
      out.push({
        id: `theme-${tax.id}`,
        type: "theme",
        label,
        sublabel: null,
        slug: tax.slug,
        imageUrl: tax.card_image_url ?? null,
        href: getThemeLandingHref(tax),
      });
    }

    for (const row of productRes.data ?? []) {
      const r = row as Record<string, unknown>;
      const id = String(r.id ?? "");
      const title = String(r.title ?? "").trim();
      if (!id || !title) continue;
      const category = typeof r.category === "string" ? r.category : "";
      const theme = typeof r.theme === "string" ? r.theme : "";
      const sublabel = [category, theme].filter(Boolean).join(" · ") || null;
      const imageUrl = typeof r.image_url === "string" ? r.image_url : null;
      out.push({
        id: `product-${id}`,
        type: "product",
        label: title,
        sublabel: sublabel || undefined,
        imageUrl,
        href: `/products/${id}`,
      });
    }
  } catch (err) {
    console.error("[search] getSearchSuggestions error:", err);
    return [];
  }

  return out;
}
```

---

### src/app/api/search/suggestions/route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { getSearchSuggestions } from "@/lib/search/getSearchSuggestions";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const keyword = q.trim();
  if (!keyword) {
    return NextResponse.json({ suggestions: [] });
  }
  try {
    const suggestions = await getSearchSuggestions(keyword);
    return NextResponse.json({ suggestions });
  } catch {
    return NextResponse.json({ suggestions: [] });
  }
}
```

---

## 4. taxonomy / destination / theme 매핑 관련

### src/lib/hubLandingLinks.ts

```ts
/**
 * 허브/상세 랜딩 링크 생성 규칙.
 *
 * - 상세 랜딩이 열려 있으면(is_landing_enabled / landing_enabled && slug):
 *   /destinations/[slug], /themes/[slug], /recommended/[slug]
 * - 아니면 fallback: /products?region=..., /products?theme=..., /recommended 또는 /products
 *
 * 상세 랜딩 URL은 DB의 slug 컬럼이 있을 때만 사용 (get*BySlug 조회 가능하도록).
 */

import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { HomeCuratedSection } from "@/types/homeCurated";
import { isLandingEnabled, isRecommendedLandingEnabled, hasValidSlug } from "@/lib/hubVisibility";

function normalizeSlug(slug: string): string {
  return slug.trim().toLowerCase().replace(/\s+/g, "-");
}

/**
 * destination(지역) 항목 카드 클릭 시 이동 URL.
 * is_landing_enabled && slug 있으면 /destinations/[slug], 아니면 /products/region/[slug] 또는 /products?region=...
 */
export function getDestinationLandingHref(d: ProductTaxonomy): string {
  const rawSlug = d.slug?.trim();
  const slug = rawSlug ? normalizeSlug(rawSlug) : null;
  const nameSlug = d.name.trim() ? normalizeSlug(d.name) : "";

  if (slug && hasValidSlug(slug) && isLandingEnabled(d)) {
    return `/destinations/${encodeURIComponent(slug)}`;
  }
  if (slug) return `/products/region/${encodeURIComponent(slug)}`;
  if (nameSlug) return `/products/region/${encodeURIComponent(nameSlug)}`;
  return `/products?region=${encodeURIComponent(d.name)}`;
}

/**
 * theme 항목 카드 클릭 시 이동 URL.
 * is_landing_enabled && slug 있으면 /themes/[slug], 아니면 /products/theme/[slug] 또는 /products?theme=...
 */
export function getThemeLandingHref(t: ProductTaxonomy): string {
  const rawSlug = t.slug?.trim();
  const slug = rawSlug ? normalizeSlug(rawSlug) : null;
  const nameSlug = t.name.trim() ? normalizeSlug(t.name) : "";

  if (slug && hasValidSlug(slug) && isLandingEnabled(t)) {
    return `/themes/${encodeURIComponent(slug)}`;
  }
  if (slug) return `/products/theme/${encodeURIComponent(slug)}`;
  if (nameSlug) return `/products/theme/${encodeURIComponent(nameSlug)}`;
  return `/products?theme=${encodeURIComponent(t.name)}`;
}

/**
 * 추천 섹션 항목 클릭 시 이동 URL.
 * landing_enabled && slug 있으면 /recommended/[slug], 아니면 허브(/recommended) 또는 /products.
 */
export function getRecommendedLandingHref(section: HomeCuratedSection): string {
  const rawSlug = section.slug?.trim();
  const slug = rawSlug ? rawSlug.toLowerCase().replace(/\s+/g, "-") : "";
  if (slug && isRecommendedLandingEnabled(section)) {
    return `/recommended/${encodeURIComponent(slug)}`;
  }
  return "/recommended";
}

/**
 * 상품군(product_line) 항목 클릭 시 이동 URL.
 * 상세 랜딩 없음 → /products?product_line=name (필터 연결).
 */
export function getProductLineLandingHref(t: ProductTaxonomy): string {
  const name = (t.name ?? "").trim();
  if (!name) return "/products";
  return `/products?product_line=${encodeURIComponent(name)}`;
}

/** @deprecated getDestinationLandingHref 사용 권장 */
export function buildDestinationHubHref(d: ProductTaxonomy): string {
  return getDestinationLandingHref(d);
}

/** @deprecated getThemeLandingHref 사용 권장 */
export function buildThemeHubHref(t: ProductTaxonomy): string {
  return getThemeLandingHref(t);
}
```

---

### src/lib/hubVisibility.ts

```ts
import type { ProductTaxonomy } from "@/types/productTaxonomy";
import type { HomeCuratedSection } from "@/types/homeCurated";

/**
 * 허브 노출 vs 상세 랜딩 공개 조건 분리.
 * - 허브 노출: is_active && is_hub_visible 만 사용. is_landing_enabled 는 허브 조회에 사용하지 않음.
 * - 상세 랜딩 공개: is_active && is_landing_enabled. /destinations/[slug], /themes/[slug] 등에서만 사용.
 */

/** 지역/테마: 허브 페이지에 카드 노출 여부. is_active && is_hub_visible */
export function isHubVisible(item: ProductTaxonomy): boolean {
  return Boolean(item.is_active && item.is_hub_visible);
}

/** 지역/테마: 상세 랜딩 페이지 공개 여부. is_active && is_landing_enabled */
export function isLandingEnabled(item: ProductTaxonomy): boolean {
  return Boolean(item.is_active && item.is_landing_enabled);
}

/** 추천 섹션: 상세 랜딩 페이지 공개 여부. landing_enabled 플래그 */
export function isRecommendedLandingEnabled(section: HomeCuratedSection): boolean {
  return section.landing_enabled === true;
}

/** slug가 상세 랜딩 URL에 쓸 수 있는지 (비어 있지 않고 URL-safe) */
export function hasValidSlug(slug: string | null | undefined): boolean {
  const s = typeof slug === "string" ? slug.trim() : "";
  return s.length > 0;
}
```

---

## 5. 상품 카드 관련 (검색 결과에서 사용)

검색 결과에서는 **ProductCardV2** 하나만 사용합니다. 가격/대표이미지/링크는 `SearchResults`에서 `product.price`, `product.image_url`, `hrefDetail={\`/products/${product.id}\`}` 로 전달합니다.

### src/components/products/ProductCardV2.tsx

```tsx
"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { buttonVariants } from "@/components/ui/Button";
import { trackProductCardClick } from "@/lib/analytics/trackProductClick";
import { CARD_TRANSITION } from "@/lib/cardTokens";
import { cn } from "@/lib/cn";

export type ProductCardV2Status =
  | "AVAILABLE"
  | "LIMITED"
  | "SOLD_OUT"
  | "CONSULT_REQUIRED";

export type ProductCardV2Badge = {
  type: string;
  label: string;
  priority?: number;
  isActive?: boolean;
};

export type ProductCardV2Props = {
  title?: string;
  price?: number | string;
  duration?: string;
  region?: string;
  categories?: string[];
  tags?: string[];
  status?: ProductCardV2Status;
  badges?: ProductCardV2Badge[];
  thumbnailUrl?: string;
  /** 상세 페이지 URL. 있으면 카드 전체가 이 주소로 이동하는 링크 영역이 됨 */
  hrefDetail?: string;
  onClickDetail?: () => void;
  onClickConsult?: () => void;
  /** 가격 기준 설명 (예: "1인 기준") */
  priceMeta?: string;
  /** 항공 포함 여부 등 메타 문구 */
  metaInfo?: string;
  /** 상품 카드 클릭 계측용 (선택). 설정 시 클릭 시 product_card_click 전송 */
  analyticsSource?: "product_list" | "landing" | "home_curated";
  analyticsSection?: string;
  /** 계측 시 사용할 상품 ID (analyticsSource 설정 시 권장) */
  productId?: string;
  /** 목록 페이지 1열 리스트용 레이아웃 시 이미지·타이틀 영역 확장 */
  layout?: "grid" | "list";
};

const STATUS_LABELS: Record<ProductCardV2Status, string> = {
  AVAILABLE: "예약 가능",
  LIMITED: "잔여 한정",
  SOLD_OUT: "마감",
  CONSULT_REQUIRED: "상담 후 안내",
};

function badgeTypeToTagVariant(
  type: string
): "accent" | "muted" | "gold" {
  const t = type?.toLowerCase() ?? "";
  if (t === "accent" || t === "primary" || t === "인기" || t === "추천") return "accent";
  if (t === "gold" || t === "제철" || t === "마감임박") return "gold";
  return "muted";
}

function badgeVariantToChipStyle(variant: "accent" | "muted" | "gold") {
  if (variant === "accent") {
    return "border-blue-200 bg-blue-600/95 text-white";
  }
  if (variant === "gold") {
    return "border-amber-200 bg-amber-500/95 text-white";
  }
  return "border-[var(--border)] bg-[var(--surface)] text-[var(--text-primary)]";
}

export default function ProductCardV2({
  title = "",
  price,
  duration = "",
  region = "",
  categories = [],
  tags = [],
  status,
  badges = [],
  thumbnailUrl = "",
  hrefDetail,
  onClickDetail,
  onClickConsult,
  priceMeta = "1인 기준",
  metaInfo = "",
  analyticsSource,
  analyticsSection,
  productId,
  layout = "grid",
}: ProductCardV2Props) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [consultPressed, setConsultPressed] = useState(false);
  const priceFormatted =
    typeof price === "number"
      ? new Intl.NumberFormat("ko-KR").format(price)
      : typeof price === "string"
        ? price
        : null;

  const sortedBadges = [...badges].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
  );
  const activeBadges = sortedBadges.filter((b) => b.isActive !== false);

  const tagVariantFromStatus = (s?: ProductCardV2Status): "accent" | "muted" | "gold" => {
    if (!s) return "muted";
    if (s === "AVAILABLE") return "accent";
    if (s === "LIMITED") return "gold";
    return "muted";
  };

  const handleConsult = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const handleConsultKey = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    if (status === "SOLD_OUT" && typeof window !== "undefined") {
      window.alert("마감된 상품입니다. 대기 문의를 남겨 주시면 다음 일정 시 안내드립니다.");
    }
    setConsultPressed(true);
    onClickConsult?.();
  };

  const statusChip =
    status != null ? { label: STATUS_LABELS[status], variant: tagVariantFromStatus(status) } : null;
  const categoryChip = categories[0]?.trim() ? { label: categories[0].trim(), variant: "muted" as const } : null;
  const themeChip = region?.trim() ? { label: region.trim(), variant: "muted" as const } : null;
  const badgeChips = activeBadges.slice(0, 1).map((b) => ({
    label: b.label,
    variant: badgeTypeToTagVariant(b.type),
  }));

  const topLeftChips = [statusChip, categoryChip, themeChip, ...badgeChips]
    .filter(
      (x): x is { label: string; variant: "accent" | "muted" | "gold" } => Boolean(x),
    )
    .filter((chip, index, arr) => {
      const key = `${chip.variant}-${chip.label}`;
      return arr.findIndex((c) => `${c.variant}-${c.label}` === key) === index;
    });

  const metaLine = [duration, metaInfo].filter(Boolean).join(" · ");
  const isListLayout = layout === "list";

  const cardContent = (
    <div className="flex min-h-[140px] w-full">
      <div
        className={cn(
          "relative shrink-0 overflow-hidden bg-[var(--surface-muted)]",
          isListLayout
            ? "w-[38%] min-w-[180px] max-w-[280px]"
            : "w-[42%] min-w-[140px] max-w-[220px]",
        )}
      >
        <div className="absolute left-2 top-2 z-10 flex flex-wrap gap-1">
          {topLeftChips.map((chip) => (
            <span
              key={`${chip.variant}-${chip.label}`}
              className={`inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold leading-none shadow-sm backdrop-blur ${badgeVariantToChipStyle(chip.variant)}`}
            >
              {chip.label}
            </span>
          ))}
        </div>

        {thumbnailUrl ? (
          <Image
            src={normalizeProductImageUrl(thumbnailUrl)}
            alt={title || "상품 이미지"}
            fill
            sizes={isListLayout ? "(max-width: 768px) 38vw, 280px" : "(max-width: 768px) 42vw, 220px"}
            className={cn("h-full w-full object-cover", CARD_TRANSITION, "group-hover:scale-[1.02]")}
            loading="lazy"
            onLoad={() => setImageLoaded(true)}
          />
        ) : null}
        <div
          className={cn(
            "absolute inset-0 bg-[var(--border)]",
            CARD_TRANSITION,
            thumbnailUrl
              ? imageLoaded
                ? "opacity-0"
                : "animate-pulse opacity-100"
              : "animate-pulse",
          )}
          aria-hidden
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <div className="relative min-h-[1.25rem] overflow-hidden">
          <h2
            className={cn(
              "font-card-title pr-8 text-sm font-semibold leading-snug text-[var(--text-primary)] md:text-base",
              isListLayout ? "line-clamp-2" : "line-clamp-1",
            )}
          >
            {title || "상품명"}
          </h2>
          <div
            className="pointer-events-none absolute right-0 top-0 h-full w-12 shrink-0 bg-gradient-to-l from-[var(--surface)] to-transparent"
            aria-hidden
          />
        </div>

        {metaLine ? (
          <p className="line-clamp-1 text-xs text-[var(--text-muted)]">{metaLine}</p>
        ) : null}

        <div className="mt-0.5 space-y-0.5">
          {priceFormatted != null ? (
            <p className="font-price-strong text-lg font-bold text-[var(--primary)] md:text-xl">
              {priceFormatted}원~
            </p>
          ) : (
            <p className="text-sm font-semibold text-[var(--text-muted)]">상담 후 견적</p>
          )}
          {priceMeta ? <p className="text-[11px] text-[var(--text-subtle)]">{priceMeta}</p> : null}
        </div>

        {tags.length > 0 ? (
          <div className="relative mt-auto flex overflow-hidden">
            <div className="flex shrink-0 flex-nowrap gap-1.5 pr-8">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex shrink-0 items-center rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-[11px] font-semibold text-[var(--text-muted)]"
                >
                  #{tag}
                </span>
              ))}
            </div>
            <div
              className="pointer-events-none absolute right-0 top-0 h-full w-12 shrink-0 bg-gradient-to-l from-[var(--surface)] to-transparent"
              aria-hidden
            />
          </div>
        ) : (
          <div className="mt-auto" />
        )}

        {onClickConsult ? (
          <div className="pt-1">
            <span
              role="button"
              tabIndex={0}
              aria-disabled={consultPressed}
              className={`${buttonVariants({ variant: "outline", size: "sm" })} inline-flex !h-7 !px-2.5 !text-xs ${
                consultPressed ? "pointer-events-none opacity-60" : ""
              }`}
              onClick={handleConsult}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") handleConsultKey(e);
              }}
            >
              {status === "SOLD_OUT" ? "대기 문의" : "상담 문의"}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  const wrapperClass = cn(
    "group flex h-full overflow-hidden",
    CARD_TRANSITION,
    "hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]",
  );

  if (hrefDetail) {
    const handleCardClick = () => {
      if (analyticsSource && hrefDetail) {
        const id = productId ?? (hrefDetail.split("/").pop() || "");
        trackProductCardClick({
          productId: id,
          productTitle: title ?? "",
          href: hrefDetail,
          source: analyticsSource,
          section: analyticsSection ?? undefined,
        });
      }
    };
    return (
      <Link href={hrefDetail} className="block h-full" onClick={handleCardClick}>
        <Card variant="interactive" className={wrapperClass}>
          {cardContent}
        </Card>
      </Link>
    );
  }

  return (
    <Card
      variant="interactive"
      className={wrapperClass}
      role="button"
      tabIndex={0}
      onClick={onClickDetail}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClickDetail?.();
        }
      }}
    >
      {cardContent}
    </Card>
  );
}
```

---

## 6. 검색 라우팅 / 링크 생성 관련

- **상품 상세 링크**: `/products/[id]` — `SearchResults` 및 자동완성 product suggestion 에서 `href: `/products/${id}`` 로 고정.
- **destination 허브/상세**: `getDestinationLandingHref(d)` — `lib/hubLandingLinks.ts` (위 4번에 전체 코드).
- **theme 허브/상세**: `getThemeLandingHref(t)` — 동일 파일.
- **/search?q=... 로 이동**: 공통 helper 없음. 호출처에서 `router.push(\`/search?q=${encodeURIComponent(trimmedQuery)}\`)` 또는 `<Link href={\`/search?q=${encodeURIComponent(keyword)}\`}>` 사용.
  - 사용 위치: `HomeHeroSearch` (handleSearch, handleSelectKeyword), 최근 검색어 chip 링크, `HeaderSearchDropdown` 선택 시 onSelectKeyword → 위 컴포넌트에서 동일 패턴으로 이동.

---

## 7. 필터/정렬 상태 관리 관련

- **검색 결과 페이지(`/search`)**:  
  - 쿼리스트링은 `q` 하나만 사용.  
  - `searchParams` 는 서버에서 `await searchParams` 로 받아 `q` 만 읽음.  
  - **필터/정렬/useSearchParams 없음.**  
  - price / theme / destination / product_line 필터는 검색 결과 페이지에 **없습니다.**

(상품 목록 페이지 `/products` 등 다른 경로에는 필터가 있을 수 있으나, `/search` 와는 별개입니다.)

---

## 8. Analytics 관련

### src/lib/analytics/events.ts

```ts
/**
 * 헤더/검색/CTA 계측용 이벤트명·소스 상수.
 */

import type { AnalyticsEventName, AnalyticsSource } from "./types";

export const ANALYTICS_EVENTS: Record<AnalyticsEventName, AnalyticsEventName> = {
  header_nav_click: "header_nav_click",
  mega_menu_open: "mega_menu_open",
  mega_menu_click: "mega_menu_click",
  mobile_menu_open: "mobile_menu_open",
  mobile_menu_expand: "mobile_menu_expand",
  mobile_menu_click: "mobile_menu_click",
  search_submit: "search_submit",
  search_suggestion_click: "search_suggestion_click",
  search_recent_click: "search_recent_click",
  search_recommended_click: "search_recommended_click",
  search_result_click: "search_result_click",
  search_no_result: "search_no_result",
  hero_search: "hero_search",
  hero_search_submit: "hero_search_submit",
  hero_autosuggest_impression: "hero_autosuggest_impression",
  hero_autosuggest_click: "hero_autosuggest_click",
  cta_click: "cta_click",
  landing_view: "landing_view",
  landing_product_click: "landing_product_click",
  product_card_click: "product_card_click",
} as const;

export const ANALYTICS_SOURCES: Record<AnalyticsSource, AnalyticsSource> = {
  header_desktop_primary: "header_desktop_primary",
  header_desktop_panel: "header_desktop_panel",
  header_mobile_drawer: "header_mobile_drawer",
  header_mobile_accordion: "header_mobile_accordion",
  header_search_desktop: "header_search_desktop",
  header_search_mobile: "header_search_mobile",
  home_curated_section: "home_curated_section",
  home_curated_catalog_cta: "home_curated_catalog_cta",
  products_catalog: "products_catalog",
  landing_region: "landing_region",
  landing_theme: "landing_theme",
  consult_cta: "consult_cta",
  hero_search: "hero_search",
} as const;
```

### src/lib/analytics/types.ts

(검색/계측 관련 타입만 발췌.)

```ts
export type AnalyticsEventName =
  | "search_submit"
  | "search_suggestion_click"
  | "search_recent_click"
  | "search_recommended_click"
  | "search_result_click"
  | "search_no_result"
  | "hero_search"
  | "hero_search_submit"
  | "hero_autosuggest_impression"
  | "hero_autosuggest_click"
  // ... 기타

export type AnalyticsPayload = {
  eventName: AnalyticsEventName;
  source: AnalyticsSource;
  pagePath: string | null;
  deviceType: "desktop" | "mobile" | "unknown";
  taxonomyType: "category" | "theme" | null;
  taxonomyId: string | null;
  taxonomySlug: string | null;
  taxonomyName: string | null;
  section: string | null;
  label: string | null;
  href: string | null;
  position: number | null;
  query: string | null;
  resultCount: number | null;
  productId: string | null;
  occurredAt: string;
};
```

### src/lib/analytics/trackClientEvent.ts

```ts
/**
 * 클라이언트에서 analytics 이벤트를 fire-and-forget으로 전송하는 공통 유틸.
 * sendBeacon 우선, 실패 시 fetch(keepalive) fallback. 어떤 경우에도 throw 하지 않는다.
 */

import type { AnalyticsPayload } from "./types";

const API_PATH = "/api/analytics/events";
const isDev = process.env.NODE_ENV === "development";

function getUrl(): string {
  if (typeof window === "undefined") return API_PATH;
  const base = window.location.origin ?? "";
  return `${base}${API_PATH}`;
}

/**
 * payload를 전송. 브라우저가 아니면 no-op.
 * sendBeacon 사용 가능하면 우선 사용, 실패 시 fetch(keepalive) fallback.
 * 전송 실패가 사용자 동작을 막지 않도록 절대 throw 하지 않는다.
 */
export function trackClientEvent(payload: AnalyticsPayload): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const url = getUrl();
    const body = JSON.stringify(payload);

    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(url, blob);
      if (sent) {
        if (isDev) {
          console.debug("[analytics] trackClientEvent sent (beacon):", payload.eventName, payload.source);
        }
        return;
      }
    }

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      if (isDev) {
        console.debug("[analytics] trackClientEvent fetch failed (fire-and-forget):", payload.eventName);
      }
    });
  } catch {
    if (isDev) {
      console.debug("[analytics] trackClientEvent threw (swallowed):", payload.eventName);
    }
  }
}
```

### src/app/api/analytics/events/route.ts

- POST only. `eventName` / `source` 검증 후 `createAnalyticsPayload` → `toRow` → `supabaseAdmin.from("analytics_events").insert(row)`.

### src/lib/analytics/saveAnalyticsEvent.ts

- `toRow(payload)`: payload → DB row (snake_case). `analytics_events` insert 시 사용.

### 검색 결과 카드 클릭 계측

- `trackProductCardClick` (`lib/analytics/trackProductClick.ts`) 사용.
- `ProductCardV2` 에서 `analyticsSource="product_list"`, `analyticsSection="search"` 이면 클릭 시 `product_card_click` 이벤트로 전송.

---

## 9. 타입 정의

### src/types/search.ts

```ts
/**
 * Hero 검색 자동완성용 추천 아이템 타입.
 */

export type SearchSuggestionType = "destination" | "theme" | "product";

export type SearchSuggestion = {
  id: string;
  type: SearchSuggestionType;
  label: string;
  sublabel?: string | null;
  slug?: string | null;
  imageUrl?: string | null;
  /** 클릭 시 이동할 URL (서버에서 허브/상세 규칙으로 생성) */
  href: string;
};
```

### src/types/productTaxonomy.ts

(검색/자동완성에서 쓰는 부분.)

```ts
export type TaxonomyType =
  | "destination"
  | "theme"
  | "product_line"
  | "campaign"
  | "tag";

export type ProductTaxonomy = {
  id: string;
  taxonomy_type: TaxonomyType;
  name: string;
  slug: string | null;
  is_active: boolean;
  sort_order: number | null;
  created_at: string | null;
  is_hub_visible: boolean;
  is_landing_enabled: boolean;
  card_title?: string | null;
  card_image_url?: string | null;
  // ... 기타
};
```

### 검색 결과 / 카드 관련

- **SearchResult 전용 타입 없음.** 검색 결과는 `Product[]` 그대로 사용.
- **ProductCardViewModel 전용 타입 없음.** `ProductCardV2` 는 `ProductCardV2Props` 로 직접 props 전달.
- **검색 페이지 props**: `SearchPageProps`: `searchParams: Promise<{ q?: string }>`.  
  `SearchResultsProps`: `{ keyword: string; products: Product[] }`.

---

# 마지막 정리

## A. 현재 검색 결과 페이지에서 지원하는 필터 목록

- **없음.**  
  `/search` 는 쿼리 파라미터 `q`(검색어)만 사용하며, price / theme / destination / product_line 등 필터는 구현되어 있지 않습니다.

---

## B. 현재 검색 submit 후 실제 이동 규칙

- **항상** `router.push(\`/search?q=${encodeURIComponent(trimmedQuery)}\`)` 로 이동합니다.  
- 버튼 클릭 / 엔터 / 최근·추천 키워드 선택 모두 동일하게 `/search?q=...` 로만 이동합니다.

---

## C. 자동완성 suggestion 클릭 시 실제 이동 규칙

- **destination**: `getDestinationLandingHref(tax)`  
  → `is_landing_enabled && slug` 이면 `/destinations/[slug]`, 아니면 `/products/region/[slug]` 또는 `/products?region=...`
- **theme**: `getThemeLandingHref(tax)`  
  → `is_landing_enabled && slug` 이면 `/themes/[slug]`, 아니면 `/products/theme/[slug]` 또는 `/products?theme=...`
- **product**: `/products/[id]` 로 직행.

---

## D. 검색 결과 카드 클릭 시 실제 이동 경로

- **항상** `/products/[id]` (상품 상세 페이지).  
  `SearchResults` 에서 `hrefDetail={\`/products/${product.id}\`}` 로 고정되어 있습니다.

---

## E. 서버 컴포넌트 / 클라이언트 컴포넌트 구분

| 경로/컴포넌트 | 구분 |
|----------------|------|
| `app/search/page.tsx` | 서버 컴포넌트 (async, searchParams 사용, searchProducts 호출) |
| `components/search/SearchResults.tsx` | 클라이언트 ("use client") |
| `components/home/HeroSection.tsx` | 클라이언트 ("use client") |
| `components/home/HomeHeroSearch.tsx` | 클라이언트 ("use client") |
| `components/search/SearchSuggestionsDropdown.tsx` | 클라이언트 ("use client") |
| `components/HeaderSearchDropdown.tsx` | 클라이언트 (이벤트/상태 사용, "use client" 없으나 상위가 클라이언트라 클라이언트 번들에 포함) |
| `lib/search/searchProducts.ts` | 서버에서만 호출 (supabase 직접 사용) |
| `lib/search/getSearchSuggestions.ts` | 서버에서만 호출 (API route 또는 서버 컴포넌트에서 사용) |
| `app/api/search/suggestions/route.ts` | API Route (서버) |

이 문서를 그대로 복사해 PR 요청문에 붙여 넣거나, 필요한 섹션만 잘라서 사용하시면 됩니다.
