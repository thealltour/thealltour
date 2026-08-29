"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import MemberLogoutButton from "@/components/auth/MemberLogoutButton";
import { cn } from "@/lib/cn";

export type UserMenuDropdownProps = {
  userName?: string | null;
  points?: number | null;
  onLogout?: () => void;
  /** 로그아웃은 MemberLogoutButton 내부 로직 사용. children으로 대체 가능 */
  logoutButton?: React.ReactNode;
};

const MENU_ITEMS: Array<{ label: string; href: string }> = [
  { label: "대시보드", href: "/mypage/dashboard" },
  { label: "예약내역", href: "/mypage/bookings" },
  { label: "견적문의 내역", href: "/quote" },
  { label: "포인트", href: "/mypage/points" },
  { label: "내 정보", href: "/mypage/profile" },
];

export default function UserMenuDropdown({
  userName = null,
  points = null,
  logoutButton,
}: UserMenuDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    function handleClickOutside(e: MouseEvent) {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        panelRef.current?.contains(target)
      ) {
        return;
      }
      setIsOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="header-user-menu"
        aria-label="마이페이지 메뉴"
        className={cn(
          "inline-flex items-center gap-1 rounded-xl px-3 py-2 text-sm font-semibold text-[var(--text-primary)]",
          "hover:bg-[var(--surface-muted)] transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface)]",
        )}
        onClick={() => setIsOpen((prev) => !prev)}
      >
        마이페이지
        <ChevronDown
          className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")}
          aria-hidden
        />
      </button>

      {isOpen && (
        <div
          ref={panelRef}
          id="header-user-menu"
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 w-56 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 shadow-[var(--shadow-soft-strong)]"
        >
          {(userName || points !== null) && (
            <div className="mb-2 border-b border-[var(--divider)] px-3 pb-2">
              {userName && (
                <p className="type-caption font-semibold text-[var(--text-primary)]">
                  {userName}님
                </p>
              )}
              {points !== null && (
                <p className="mt-0.5 type-caption text-[var(--text-muted)]">
                  포인트 {points.toLocaleString("ko-KR")}P
                </p>
              )}
            </div>
          )}

          {MENU_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              className="flex items-center rounded-xl px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
              onClick={() => setIsOpen(false)}
            >
              {item.label}
            </Link>
          ))}

          <div className="my-1 border-t border-[var(--divider)]" aria-hidden />

          <div
            role="menuitem"
            className={cn(
              "rounded-xl",
              "[&_button]:flex [&_button]:w-full [&_button]:items-center [&_button]:justify-start [&_button]:rounded-xl [&_button]:px-3 [&_button]:py-2 [&_button]:text-sm [&_button]:font-medium [&_button]:text-[var(--text-primary)] [&_button]:hover:bg-[var(--surface-muted)]",
            )}
          >
            {logoutButton ?? <MemberLogoutButton />}
          </div>
        </div>
      )}
    </div>
  );
}
