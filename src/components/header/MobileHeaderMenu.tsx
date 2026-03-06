"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Search, MessageCircle } from "lucide-react";
import { useConsultModal } from "@/components/ConsultModal";
import { MobileHeaderDrawer } from "./MobileHeaderDrawer";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

export type MobileHeaderMenuProps = {
  primaryNav: HeaderPrimaryNavItem[];
  activeTab?: "about" | "quote" | "reviews" | "blog" | "support" | "products" | "signup";
  searchQuery?: string;
  session: { name: string } | null;
};

export function MobileHeaderMenu({
  primaryNav,
  activeTab: _activeTab,
  searchQuery,
  session,
}: MobileHeaderMenuProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const { openModal } = useConsultModal();

  useEffect(() => {
    function handleToggle() {
      setIsDrawerOpen((prev) => !prev);
    }
    window.addEventListener("thealltour-mobile-menu-toggle", handleToggle as EventListener);
    return () => {
      window.removeEventListener("thealltour-mobile-menu-toggle", handleToggle as EventListener);
    };
  }, []);

  function openDrawer() {
    setIsDrawerOpen(true);
  }

  function openDrawerWithTrack(label: "hamburger" | "search_icon") {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.mobile_menu_open,
        source: ANALYTICS_SOURCES.header_mobile_drawer,
        label,
        section: "mobile_header",
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("mobile"),
      }),
    );
    openDrawer();
  }

  function closeDrawer() {
    setIsDrawerOpen(false);
  }

  function handleConsultClick() {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.cta_click,
        source: ANALYTICS_SOURCES.consult_cta,
        section: "mobile_header",
        label: "상담 문의",
        href: "/quote",
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("mobile"),
      }),
    );
    openModal({
      productTitle: "패키지/골프 맞춤 상담",
      sourcePath: typeof window !== "undefined" ? `${window.location.pathname}#mobile-header-consult` : "",
    });
  }

  return (
    <>
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-2 px-4 lg:hidden md:px-6">
        <button
          type="button"
          aria-label="메뉴 열기"
          onClick={() => openDrawerWithTrack("hamburger")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-transparent text-[var(--foreground)] transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--focus-ring)]"
        >
          <span className="flex flex-col gap-[3px]" aria-hidden>
            <span className="h-[2px] w-4 rounded-full bg-current" />
            <span className="h-[2px] w-4 rounded-full bg-current" />
            <span className="h-[2px] w-4 rounded-full bg-current" />
          </span>
        </button>

        <Link
          href="/"
          className="flex min-w-0 flex-1 items-center justify-center gap-2 leading-tight"
          aria-label="더올투어 홈"
        >
          <Image
            src="/thealltour-logo.png"
            alt=""
            width={40}
            height={40}
            sizes="40px"
            className="h-8 w-8 shrink-0 object-contain"
          />
          <div className="flex min-w-0 flex-col">
            <span className="heading-display-hero type-small font-bold tracking-tight text-[var(--secondary)]">
              더올투어
            </span>
            <span className="mt-0.5 type-caption font-medium tracking-wide text-[var(--text-muted)]">
              Golf & Premium Travel
            </span>
          </div>
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label="검색"
            onClick={() => openDrawerWithTrack("search_icon")}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--foreground)] transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <Search className="h-5 w-5" aria-hidden />
          </button>
          <a
            href="/quote"
            onClick={(e) => {
              e.preventDefault();
              handleConsultClick();
            }}
            aria-label="상담 문의"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-[var(--foreground)] transition-colors active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            <MessageCircle className="h-5 w-5" aria-hidden />
          </a>
        </div>
      </div>

      <MobileHeaderDrawer
        primaryNav={primaryNav}
        isOpen={isDrawerOpen}
        onClose={closeDrawer}
        session={session}
        searchQuery={searchQuery}
      />
    </>
  );
}
