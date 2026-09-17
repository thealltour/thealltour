"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";
import { HEADER_DESKTOP_PRIMARY_NAV_KEYS } from "./headerNav.constants";
import type { HeaderPrimaryNavKey } from "./headerNav.constants";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { DesktopNavItem } from "./DesktopNavItem";
import { DesktopMegaMenuPanel } from "./DesktopMegaMenuPanel";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { buildGolfProductsHref, isGolfTourType } from "@/lib/products/golfChannel";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

function getNavLinkClass(isActive: boolean) {
  const base =
    "relative shrink-0 whitespace-nowrap text-base tracking-tight transition-colors duration-150 py-1.5 px-2.5 rounded-lg";
  if (isActive) {
    return cn(
      base,
      "bg-[var(--primary-soft)] font-medium text-[var(--primary)]",
    );
  }
  return cn(
    base,
    "font-normal text-[var(--text-muted)]",
    "hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
  );
}

function getIsActive(item: HeaderPrimaryNavItem, pathname: string): boolean {
  const key = item.key as HeaderPrimaryNavKey;
  if (key === "recommended") return pathname === "/recommended";
  if (key === "region") return pathname === "/destinations" || pathname.startsWith("/destinations/");
  if (key === "theme") return pathname === "/themes" || pathname.startsWith("/themes/");
  if (key === "inquiry") return pathname === "/quote";
  if (key === "guides") return pathname.startsWith("/guides");
  if (key === "support") return pathname.startsWith("/support");
  return false;
}

export function DesktopMegaMenu({ primaryNav }: { primaryNav: HeaderPrimaryNavItem[] }) {
  const pathname = usePathname();
  const [tourTypeParam, setTourTypeParam] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<HeaderPrimaryNavKey | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const golfHref = buildGolfProductsHref();
  const golfActive = pathname === "/products" && isGolfTourType(tourTypeParam);
  const items = primaryNav.filter((p) =>
    HEADER_DESKTOP_PRIMARY_NAV_KEYS.includes(p.key as HeaderPrimaryNavKey),
  );
  const beforeInquiry = items.filter((p) => p.key !== "inquiry");
  const inquiryItem = items.find((p) => p.key === "inquiry");

  const onClose = useCallback(() => setOpenKey(null), []);

  const scheduleClose = useCallback(() => {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => {
      closeTimeoutRef.current = null;
      setOpenKey(null);
    }, 180);
  }, []);

  const cancelClose = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    setTourTypeParam(new URLSearchParams(window.location.search).get("tourType"));
  }, [pathname]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpenKey(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenKey(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div
      ref={containerRef}
      className="relative"
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
    >
      <nav className="flex shrink-0 items-center gap-x-5 lg:gap-x-6 xl:gap-x-7" aria-label="탐색 메뉴">
        {beforeInquiry.map((item, index) => (
          <DesktopNavItem
            key={item.key}
            item={item}
            positionIndex={index}
            isOpen={openKey === (item.key as HeaderPrimaryNavKey)}
            onOpen={() => setOpenKey(item.key as HeaderPrimaryNavKey)}
            onClose={onClose}
            scheduleClose={scheduleClose}
            cancelClose={cancelClose}
            isActive={getIsActive(item, pathname)}
            getNavLinkClass={getNavLinkClass}
            renderPanelInParent
          />
        ))}
        <Link
          href={golfHref}
          className={getNavLinkClass(golfActive)}
          onClick={() => {
            trackClientEvent(
              createAnalyticsPayload({
                eventName: ANALYTICS_EVENTS.header_nav_click,
                source: ANALYTICS_SOURCES.header_desktop_primary,
                label: "골프",
                href: golfHref,
                section: "golf",
                taxonomyType: null,
                position: beforeInquiry.length,
                pagePath: typeof window !== "undefined" ? window.location.pathname : null,
                deviceType: inferDeviceType("desktop"),
              }),
            );
          }}
        >
          골프
        </Link>
        {inquiryItem ? (
          <DesktopNavItem
            key={inquiryItem.key}
            item={inquiryItem}
            positionIndex={beforeInquiry.length + 1}
            isOpen={openKey === (inquiryItem.key as HeaderPrimaryNavKey)}
            onOpen={() => setOpenKey(inquiryItem.key as HeaderPrimaryNavKey)}
            onClose={onClose}
            scheduleClose={scheduleClose}
            cancelClose={cancelClose}
            isActive={getIsActive(inquiryItem, pathname)}
            getNavLinkClass={getNavLinkClass}
            renderPanelInParent
          />
        ) : null}
      </nav>
      {openKey && (() => {
        const item = items.find((i) => i.key === openKey);
        return item ? <DesktopMegaMenuPanel item={item} onClose={onClose} /> : null;
      })()}
    </div>
  );
}
