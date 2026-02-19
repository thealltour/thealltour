"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4">
      <path
        d="M21 21l-4.35-4.35m1.35-5.15a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function HeaderProductSearch({ searchQuery, mode }: HeaderProductSearchProps) {
  const router = useRouter();
  const [query, setQuery] = useState(searchQuery ?? "");
  const [suggestions, setSuggestions] = useState<ProductSuggestion[]>([]);
  const [isFocused, setIsFocused] = useState(false);

  const trimmedQuery = useMemo(() => query.trim(), [query]);
  const showSuggestions = isFocused && trimmedQuery.length > 0 && suggestions.length > 0;

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = query.trim();
    if (!value) return;
    setIsFocused(false);
    router.push(`/products?q=${encodeURIComponent(value)}`);
  }

  function handleSelectSuggestion(value: string) {
    setQuery(value);
    setIsFocused(false);
    router.push(`/products?q=${encodeURIComponent(value)}`);
  }

  function renderSuggestionList(containerWidthClass: string) {
    if (!showSuggestions) return null;

    return (
      <ul
        className={`absolute top-12 z-50 max-h-72 overflow-y-auto rounded-2xl border border-[#bfdbfe] bg-white p-1.5 shadow-xl ${containerWidthClass}`}
      >
        {suggestions.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                handleSelectSuggestion(item.title);
              }}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition hover:bg-[#eff6ff]"
            >
              <span className="text-sm font-medium text-slate-700">{item.title}</span>
              <span className="ml-3 shrink-0 text-xs text-slate-400">
                {item.theme ? `${item.category} · ${item.theme}` : item.category}
              </span>
            </button>
          </li>
        ))}
      </ul>
    );
  }

  if (mode === "desktop") {
    return (
      <form onSubmit={handleSubmit} className="relative hidden lg:flex">
        <label htmlFor="header-product-search-desktop" className="sr-only">
          패키지상품 검색
        </label>
        <div className="relative">
          <input
            id="header-product-search-desktop"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 120)}
            placeholder="어디로 떠나실 예정이신가요?"
            className="h-10 w-[clamp(16rem,22vw,20rem)] rounded-full border border-[#bfdbfe] bg-white pl-4 pr-11 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#60a5fa] focus:ring-2 focus:ring-[#dbeafe]"
            autoComplete="off"
          />
          <button
            type="submit"
            aria-label="패키지상품 검색"
            className="absolute top-1/2 right-1.5 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-[#eff6ff] hover:text-[var(--brand-strong)]"
          >
            <SearchIcon />
          </button>
        </div>
        {renderSuggestionList("right-0 w-[clamp(16rem,22vw,20rem)]")}
      </form>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex w-full lg:hidden">
      <label htmlFor="header-product-search-mobile" className="sr-only">
        패키지상품 검색
      </label>
      <div className="relative w-full">
        <input
          id="header-product-search-mobile"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 120)}
          placeholder="어디로 떠나실 예정이신가요?"
          className="h-10 w-full rounded-full border border-[#bfdbfe] bg-white pl-4 pr-11 text-[14px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#60a5fa] focus:ring-2 focus:ring-[#dbeafe]"
          autoComplete="off"
        />
        <button
          type="submit"
          aria-label="패키지상품 검색"
          className="absolute top-1/2 right-1.5 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-[#eff6ff] hover:text-[var(--brand-strong)]"
        >
          <SearchIcon />
        </button>
      </div>
      {renderSuggestionList("left-0 right-0")}
    </form>
  );
}
