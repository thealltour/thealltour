"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { X, LogIn, LogOut } from "lucide-react";
import HeaderProductSearch from "@/components/header/HeaderProductSearch";
import { MobileHeaderAccordion } from "./MobileHeaderAccordion";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { cn } from "@/lib/cn";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export type MobileHeaderDrawerProps = {
  primaryNav: HeaderPrimaryNavItem[];
  isOpen: boolean;
  onClose: () => void;
  session: { name: string } | null;
  searchQuery?: string;
};

export function MobileHeaderDrawer({
  primaryNav,
  isOpen,
  onClose,
  session,
  searchQuery,
}: MobileHeaderDrawerProps) {
  const pathname = usePathname();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  const items = primaryNav;

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) setExpandedKey(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    onClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleToggle(key: string) {
    const item = items.find((i) => i.key === key);
    const isExpanding = expandedKey !== key;
    if (isExpanding && item) {
      trackClientEvent(
        createAnalyticsPayload({
          eventName: ANALYTICS_EVENTS.mobile_menu_expand,
          source: ANALYTICS_SOURCES.header_mobile_accordion,
          section: item.key,
          label: item.label,
          pagePath: typeof window !== "undefined" ? window.location.pathname : null,
          deviceType: inferDeviceType("mobile"),
        }),
      );
    }
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  if (!isOpen) return null;

  const content = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="메뉴"
      className="fixed inset-0 z-[70] flex flex-col bg-[var(--overlay)] safe-top safe-bottom"
      onClick={handleOverlayClick}
    >
      <div
        className={cn(
          "flex w-full max-w-sm flex-1 flex-col bg-[var(--surface-elevated)] shadow-[var(--shadow-modal)]",
          "ml-0 overflow-hidden",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--divider)] px-4">
          <span className="type-small font-semibold text-[var(--foreground)]">메뉴</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          <div className="shrink-0 border-b border-[var(--divider)] p-4">
            <HeaderProductSearch mode="mobile" searchQuery={searchQuery} />
          </div>

          <div className="flex-1 px-0">
            <MobileHeaderAccordion
              items={items}
              expandedKey={expandedKey}
              onToggle={handleToggle}
              onNavigate={onClose}
            />
          </div>

          <div className="shrink-0 border-t border-[var(--divider)] p-4">
            {session ? (
              <div className="flex flex-col gap-2">
                <Link
                  href="/mypage"
                  onClick={onClose}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-transparent px-4 py-3 type-small font-semibold text-[var(--foreground)] active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  마이페이지
                </Link>
                <Link
                  href="/mypage/points"
                  onClick={onClose}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 type-small font-semibold text-[var(--foreground)] active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  포인트 내역
                </Link>
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 type-small font-semibold text-[var(--foreground)] active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  onClick={() => {
                    onClose();
                    fetch("/api/members/logout", { method: "POST" }).then(() => window.location.reload());
                  }}
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  로그아웃
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                onClick={onClose}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-4 py-3 type-small font-semibold text-[var(--on-primary)] active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                  solidButtonShadowClasses,
                )}
              >
                <LogIn className="h-4 w-4" aria-hidden />
                로그인
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
