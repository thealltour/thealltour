"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { X, LogIn, LogOut } from "lucide-react";
import { useAuthModal } from "@/components/auth/AuthModalProvider";
import HeaderProductSearch from "@/components/header/HeaderProductSearch";
import { MobileHeaderAccordion } from "./MobileHeaderAccordion";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { cn } from "@/lib/cn";
import { solidButtonShadowClasses } from "@/components/ui/Button";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { buildGolfProductsHref, isGolfTourType, GOLF_TOUR_TYPE } from "@/lib/products/golfChannel";
import { restoreFocus, trapOverlayTabKey } from "@/lib/a11y/overlayFocus";
import { ENABLE_FREE_TRAVEL_PLANNER } from "@/config/featureFlags";
import { PLANNER_SAVED_LIST_PATH } from "@/lib/planner/memberAccountNav";

export const MOBILE_HEADER_NAVIGATION_ID = "mobile-header-navigation";

export type MobileHeaderDrawerProps = {
  primaryNav: HeaderPrimaryNavItem[];
  isOpen: boolean;
  onClose: () => void;
  session: { name: string } | null;
  searchQuery?: string;
};

const ACCORDION_KEYS = new Set(["recommended", "region", "theme"]);

const directLinkClass =
  "flex min-h-11 w-full items-center justify-between px-4 py-3 type-small font-semibold text-[var(--foreground)] transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset";

const secondaryLinkClass =
  "flex min-h-11 w-full items-center justify-between px-4 py-3 type-small font-medium text-[var(--text-muted)] transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset";

export function MobileHeaderDrawer({
  primaryNav,
  isOpen,
  onClose,
  session,
  searchQuery,
}: MobileHeaderDrawerProps) {
  const pathname = usePathname();
  const [tourTypeParam, setTourTypeParam] = useState<string | null>(null);
  const { openAuth } = useAuthModal();
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previousFocusedElementRef = useRef<HTMLElement | null>(null);

  const isHome = pathname === "/";
  const golfHref = buildGolfProductsHref();
  const accordionItems = primaryNav.filter((item) => ACCORDION_KEYS.has(item.key));
  const inquiryItem = primaryNav.find((item) => item.key === "inquiry");
  const golfChannelActive = pathname === "/products" && isGolfTourType(tourTypeParam);
  const productsActive = pathname === "/products" && !golfChannelActive;

  useEffect(() => {
    if (!isOpen) return;
    setTourTypeParam(new URLSearchParams(window.location.search).get("tourType"));
  }, [isOpen, pathname]);

  useEffect(() => {
    if (!isOpen) return;

    previousFocusedElementRef.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const frame = requestAnimationFrame(() => {
      closeButtonRef.current?.focus();
    });

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      const root = panelRef.current ?? overlayRef.current;
      if (root) trapOverlayTabKey(e, root);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prevOverflow;
      restoreFocus(previousFocusedElementRef.current);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) setExpandedKey(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    onClose();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleToggle(key: string) {
    const item = accordionItems.find((i) => i.key === key);
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

  function trackDirectNav(label: string, href: string, section: string) {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.mobile_menu_click,
        source: ANALYTICS_SOURCES.header_mobile_drawer,
        section,
        label,
        href,
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("mobile"),
      }),
    );
  }

  if (!isOpen) return null;

  const content = (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-label="메뉴"
      id={MOBILE_HEADER_NAVIGATION_ID}
      className="fixed inset-0 z-[70] flex flex-col bg-[var(--overlay)] safe-top safe-bottom"
      onClick={handleOverlayClick}
    >
      <div
        ref={panelRef}
        className={cn(
          "flex w-full max-w-sm flex-1 flex-col glass-float",
          "ml-0 overflow-hidden",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-[var(--divider)] px-4">
          <span className="type-small font-semibold text-[var(--foreground)]">메뉴</span>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="메뉴 닫기"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[var(--text-muted)] transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-1 flex-col overflow-y-auto">
          {isHome ? (
            <div className="shrink-0 border-b border-[var(--divider)] p-4">
              <HeaderProductSearch mode="mobile" searchQuery={searchQuery} />
            </div>
          ) : null}

          <div className="shrink-0 border-b border-[var(--divider)] p-4">
            {session ? (
              <div className="flex flex-col gap-2">
                <Link
                  href="/mypage/dashboard"
                  onClick={() => {
                    trackDirectNav("마이페이지", "/mypage/dashboard", "account");
                    onClose();
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-transparent px-4 py-3 type-small font-semibold text-[var(--foreground)] active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  마이페이지
                </Link>
                <Link
                  href="/mypage/bookings"
                  onClick={() => {
                    trackDirectNav("예약내역", "/mypage/bookings", "account");
                    onClose();
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 type-small font-semibold text-[var(--foreground)] active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  예약내역
                </Link>
                {ENABLE_FREE_TRAVEL_PLANNER ? (
                  <Link
                    href={PLANNER_SAVED_LIST_PATH}
                    onClick={() => {
                      trackDirectNav("내 여행 플랜", PLANNER_SAVED_LIST_PATH, "account");
                      onClose();
                    }}
                    className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 type-small font-semibold text-[var(--foreground)] active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  >
                    내 여행 플랜
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openAuth({ mode: "login", next: pathname });
                  }}
                  className={cn(
                    "flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border-strong)] bg-[var(--primary)] px-4 py-3 type-small font-semibold text-[var(--on-primary)] active:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]",
                    solidButtonShadowClasses,
                  )}
                >
                  <LogIn className="h-4 w-4" aria-hidden />
                  로그인
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openAuth({ mode: "signup", next: pathname });
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 type-small font-semibold text-[var(--foreground)] active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  회원가입
                </button>
              </div>
            )}
          </div>

          <div className="border-b border-[var(--divider)] py-1">
            <Link
              href="/products"
              className={cn(
                directLinkClass,
                productsActive && "bg-[var(--primary-soft)] text-[var(--primary)]",
              )}
              onClick={() => {
                trackDirectNav("전체 상품", "/products", "products");
                onClose();
              }}
            >
              전체 상품
            </Link>
            <Link
              href={golfHref}
              className={cn(
                directLinkClass,
                golfChannelActive && "bg-[var(--primary-soft)] text-[var(--primary)]",
              )}
              onClick={() => {
                trackDirectNav("골프 여행", golfHref, GOLF_TOUR_TYPE);
                onClose();
              }}
            >
              골프 여행
            </Link>
          </div>

          <div className="flex-1 px-0">
            <MobileHeaderAccordion
              items={accordionItems}
              expandedKey={expandedKey}
              onToggle={handleToggle}
              onNavigate={onClose}
            />
          </div>

          <div className="border-t border-[var(--divider)] py-1">
            <Link
              href="/reviews"
              className={secondaryLinkClass}
              onClick={() => {
                trackDirectNav("여행후기", "/reviews", "content");
                onClose();
              }}
            >
              여행후기
            </Link>
            <Link
              href="/blog"
              className={secondaryLinkClass}
              onClick={() => {
                trackDirectNav("블로그", "/blog", "content");
                onClose();
              }}
            >
              블로그
            </Link>
            {inquiryItem?.href ? (
              <Link
                href={inquiryItem.href}
                className={directLinkClass}
                onClick={() => {
                  trackDirectNav(inquiryItem.label, inquiryItem.href!, "inquiry");
                  onClose();
                }}
              >
                {inquiryItem.label}
              </Link>
            ) : (
              <Link
                href="/quote"
                className={directLinkClass}
                onClick={() => {
                  trackDirectNav("맞춤/단체문의", "/quote", "inquiry");
                  onClose();
                }}
              >
                맞춤/단체문의
              </Link>
            )}
          </div>

          {session ? (
            <div className="shrink-0 border-t border-[var(--divider)] p-4">
              <div className="flex flex-col gap-2">
                <Link
                  href="/mypage/points"
                  onClick={() => {
                    trackDirectNav("포인트", "/mypage/points", "account");
                    onClose();
                  }}
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 type-small font-semibold text-[var(--foreground)] active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                >
                  포인트
                </Link>
                <button
                  type="button"
                  className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-transparent px-4 py-3 type-small font-semibold text-[var(--foreground)] active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                  onClick={() => {
                    onClose();
                    fetch("/api/members/logout", { method: "POST" }).then(() =>
                      window.location.reload(),
                    );
                  }}
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  로그아웃
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}

