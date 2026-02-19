"use client";

type HeaderProductSearchProps = {
  searchQuery?: string;
  mode: "desktop" | "mobile";
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
  if (mode === "desktop") {
    return (
      <form action="/products" className="hidden lg:flex">
        <label htmlFor="header-product-search-desktop" className="sr-only">
          패키지상품 검색
        </label>
        <div className="relative">
          <input
            id="header-product-search-desktop"
            name="q"
            type="search"
            defaultValue={searchQuery}
            placeholder="어디로 떠나실 예정이신가요?"
            className="h-10 w-[clamp(16rem,22vw,20rem)] rounded-full border border-[#bfdbfe] bg-white pl-4 pr-11 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#60a5fa] focus:ring-2 focus:ring-[#dbeafe]"
          />
          <button
            type="submit"
            aria-label="패키지상품 검색"
            className="absolute top-1/2 right-1.5 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-[#eff6ff] hover:text-[var(--brand-strong)]"
          >
            <SearchIcon />
          </button>
        </div>
      </form>
    );
  }

  return (
    <form action="/products" className="flex w-full lg:hidden">
      <label htmlFor="header-product-search-mobile" className="sr-only">
        패키지상품 검색
      </label>
      <div className="relative w-full">
        <input
          id="header-product-search-mobile"
          name="q"
          type="search"
          defaultValue={searchQuery}
          placeholder="어디로 떠나실 예정이신가요?"
          className="h-10 w-full rounded-full border border-[#bfdbfe] bg-white pl-4 pr-11 text-[14px] text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-[#60a5fa] focus:ring-2 focus:ring-[#dbeafe]"
        />
        <button
          type="submit"
          aria-label="패키지상품 검색"
          className="absolute top-1/2 right-1.5 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-500 transition hover:bg-[#eff6ff] hover:text-[var(--brand-strong)]"
        >
          <SearchIcon />
        </button>
      </div>
    </form>
  );
}
