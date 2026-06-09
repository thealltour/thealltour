"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { AdminGlobalSearchResponse } from "@/lib/adminGlobalSearch";

type AdminGlobalSearchProps = {
  className?: string;
};

export default function AdminGlobalSearch({ className }: AdminGlobalSearchProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdminGlobalSearchResponse | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchResults = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/search?q=${encodeURIComponent(trimmed)}&limit=5`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        setResult(null);
        return;
      }
      const data = (await res.json()) as AdminGlobalSearchResponse;
      setResult(data);
    } catch {
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "/" && !event.ctrlKey && !event.metaKey && !event.altKey) {
        const target = event.target as HTMLElement | null;
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) {
          return;
        }
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setResult(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void fetchResults(query);
    }, 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, fetchResults]);

  const hasGroups = (result?.groups.length ?? 0) > 0;

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      <div className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5">
        <Search className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="문의·회원·상품 검색 (/)"
          className="w-44 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)] md:w-56"
          aria-label="관리자 통합 검색"
          aria-expanded={open}
          autoComplete="off"
        />
      </div>

      {open && query.trim() ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-[var(--border)] bg-[var(--surface)] py-2 shadow-lg">
          {loading ? (
            <p className="px-4 py-2 text-sm text-[var(--text-muted)]">검색 중…</p>
          ) : hasGroups ? (
            result!.groups.map((group) => (
              <div key={group.type} className="px-2 py-1">
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                  {group.label}
                </p>
                <ul>
                  {group.items.map((item) => (
                    <li key={`${group.type}-${item.id}`}>
                      <Link
                        href={item.href}
                        onClick={() => {
                          setOpen(false);
                          setQuery("");
                        }}
                        className="block rounded-md px-2 py-2 hover:bg-[var(--surface-muted)]"
                      >
                        <span className="block text-sm font-medium text-[var(--text-primary)]">{item.title}</span>
                        <span className="block text-xs text-[var(--text-muted)]">{item.subtitle}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <p className="px-4 py-2 text-sm text-[var(--text-muted)]">검색 결과가 없습니다.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
