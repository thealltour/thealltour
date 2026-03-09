"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

export type StickySectionNavSection = {
  id: string;
  label: string;
};

export type StickySectionNavProps = {
  sections: StickySectionNavSection[];
  /** 스크롤 스파이 오프셋(상단 여유). px */
  scrollOffset?: number;
  /** desktop: 좌측 sticky만. mobile: Hero 아래 칩만. */
  variant?: "desktop" | "mobile";
  className?: string;
};

const NAV_LINK_BASE =
  "block w-full rounded-lg py-2 px-3 text-left text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1";
const NAV_LINK_DEFAULT = "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]";
const NAV_LINK_ACTIVE = "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]";

function scrollToSection(id: string) {
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function StickySectionNav({
  sections,
  scrollOffset = 140,
  variant = "desktop",
  className,
}: StickySectionNavProps) {
  const [activeId, setActiveId] = useState<string | null>(sections[0]?.id ?? null);
  const ticking = useRef(false);

  const updateActive = useCallback(() => {
    if (typeof window === "undefined" || sections.length === 0) return;
    const scrollY = window.scrollY + scrollOffset;
    let current: string | null = null;
    for (let i = sections.length - 1; i >= 0; i--) {
      const el = document.getElementById(sections[i].id);
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY;
        if (scrollY >= top) {
          current = sections[i].id;
          break;
        }
      }
    }
    if (!current && sections[0]) current = sections[0].id;
    setActiveId((prev) => (prev !== current ? current : prev));
  }, [sections, scrollOffset]);

  useEffect(() => {
    updateActive();
    const onScroll = () => {
      if (!ticking.current) {
        requestAnimationFrame(() => {
          updateActive();
          ticking.current = false;
        });
        ticking.current = true;
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [updateActive]);

  return (
    <>
      {/* 데스크탑: 좌측 Sticky */}
      {(variant === "desktop") && (
      <aside
        className={cn(
          "hidden lg:block shrink-0",
          "sticky top-[120px] self-start",
          "w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]",
          className,
        )}
        aria-label="빠른 이동"
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">빠른 이동</p>
        <nav className="flex flex-col gap-0.5" role="navigation">
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToSection(s.id);
              }}
              className={cn(
                NAV_LINK_BASE,
                activeId === s.id ? NAV_LINK_ACTIVE : NAV_LINK_DEFAULT,
              )}
              aria-current={activeId === s.id ? "true" : undefined}
            >
              {s.label}
            </a>
          ))}
        </nav>
        <div className="mt-6 border-t border-[var(--border)] pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">문의</p>
          <div className="flex flex-col gap-2">
            <Link
              href="/products"
              className="type-btn inline-flex items-center justify-center rounded-xl bg-[var(--primary)] px-3 py-2 text-sm font-semibold text-[var(--on-primary)] transition hover:opacity-90"
            >
              전체 상품 보기
            </Link>
            <Link
              href="/quote"
              className="type-btn inline-flex items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-semibold text-[var(--foreground)] transition hover:bg-[var(--surface-muted)]"
            >
              맞춤 상담 문의
            </Link>
          </div>
        </div>
      </aside>
      )}

      {/* 모바일: Hero 아래 가로 스크롤 칩 */}
      {(variant === "mobile") && (
      <div className="lg:hidden w-full overflow-x-auto scrollbar-hide -mx-4 px-4 mb-6" aria-label="빠른 이동">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">빠른 이동</p>
        <div className="flex gap-2 pb-1">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => scrollToSection(s.id)}
              className={cn(
                "shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                activeId === s.id
                  ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                  : "border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] hover:bg-[var(--surface-muted)]",
              )}
              aria-current={activeId === s.id ? "true" : undefined}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      )}
    </>
  );
}
