"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, User } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import { cn } from "@/lib/cn";
import { solidButtonShadowClasses } from "@/components/ui/Button";

const QUICK_LINKS: Array<{ label: string; href: string; requiresAuth?: boolean }> = [
  { label: "견적문의 내역", href: "/quote", requiresAuth: true },
  { label: "포인트", href: "/mypage/points", requiresAuth: true },
  { label: "마이페이지", href: "/mypage", requiresAuth: true },
];

export default function GuestAuthHoverMenu() {
  const { openAuth } = useAuthModal();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  function handleQuickLink(href: string, requiresAuth?: boolean) {
    setIsOpen(false);
    if (requiresAuth) {
      openAuth({ mode: "login", next: href });
      return;
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-label="로그인 및 회원가입"
        className={cn(
          "inline-flex shrink-0 items-center gap-2 rounded-xl px-2 py-1.5 text-left transition",
          "hover:bg-[var(--surface-muted)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
        )}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        <User className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-xs text-[var(--text-muted)]">환영합니다!</span>
          <span className="whitespace-nowrap text-sm text-[var(--text-primary)]">로그인 / 회원가입</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-[var(--text-muted)] transition", isOpen && "rotate-180")} />
      </button>

      {isOpen ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft-strong)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              openAuth({ mode: "login" });
            }}
            className={cn(
              "w-full rounded-full bg-[var(--foreground)] px-4 py-2.5 text-sm font-semibold text-[var(--surface)] transition hover:opacity-90",
              solidButtonShadowClasses,
            )}
          >
            로그인
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setIsOpen(false);
              openAuth({ mode: "signup" });
            }}
            className="mt-3 w-full text-center text-sm font-medium text-[var(--text-primary)] hover:underline"
          >
            회원가입하기
          </button>

          <div className="my-3 border-t border-[var(--divider)]" aria-hidden />

          <ul className="space-y-1">
            {QUICK_LINKS.map((item) => (
              <li key={item.href}>
                {item.requiresAuth ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => handleQuickLink(item.href, item.requiresAuth)}
                    className="flex w-full items-center rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    role="menuitem"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center rounded-xl px-3 py-2 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-muted)]"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
