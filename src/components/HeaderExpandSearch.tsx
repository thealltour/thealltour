"use client";

import { useRef, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";
import HeaderProductSearch from "@/components/HeaderProductSearch";

type HeaderExpandSearchProps = {
  searchQuery?: string;
};

/**
 * 비홈 페이지에서만 헤더 우측에 표시되는 검색 아이콘.
 * 클릭 시 확장된 검색창(HeaderProductSearch)을 팝오버로 노출.
 */
export function HeaderExpandSearch({ searchQuery }: HeaderExpandSearchProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isHome = pathname === "/";
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  if (isHome) return null;

  return (
    <div ref={containerRef} className="relative flex shrink-0 items-center">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-label="상품 검색 열기"
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-muted)] transition",
          "hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2",
          open && "bg-[var(--surface-muted)] text-[var(--foreground)]",
        )}
      >
        <Search className="h-5 w-5" aria-hidden />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-2 w-[min(420px,calc(100vw-2rem))] rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-[var(--shadow-soft)]"
          role="dialog"
          aria-label="검색"
        >
          <HeaderProductSearch mode="desktop" searchQuery={searchQuery} />
        </div>
      )}
    </div>
  );
}
