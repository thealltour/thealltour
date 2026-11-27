"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { usePathname } from "next/navigation";
import type { HeaderPrimaryNavKey } from "./headerNav.constants";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { assembleCatalogPrimaryNav } from "./assembleCatalogPrimaryNav";
import { DesktopNavItem } from "./DesktopNavItem";
import { DesktopMegaMenuPanel } from "./DesktopMegaMenuPanel";
import { cn } from "@/lib/cn";
import Link from "next/link";
import { buildGolfProductsHref, isGolfTourType } from "@/lib/products/golfChannel";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";
import { isPlannerPath } from "@/lib/planner/entryNavigation";

function getNavLinkClass(isActive: boolean) {
  const base =
    "relative shrink-0 whitespace-nowrap text-[15px] tracking-tight transition-colors duration-150 py-2.5 px-3 rounded-md";
  if (isActive) {
    return cn(
      base,
      "bg-white/15 font-semibold text-white",
    );
  }
  return cn(
    base,
    "font-medium text-white/90",
    "hover:bg-white/10 hover:text-white",
  );
}

function getIsActive(item: HeaderPrimaryNavItem, pathname: string, tourTypeParam: string | null): boolean {
  const key = item.key as HeaderPrimaryNavKey | "package";
  if (key === "package") {
    return (
      (pathname === "/products" && !isGolfTourType(tourTypeParam)) ||
      pathname === "/recommended" ||
      pathname === "/destinations" ||
      pathname.startsWith("/destinations/")
    );
  }
  if (key === "recommended") return pathname === "/recommended";
  if (key === "region") return pathname === "/destinations" || pathname.startsWith("/destinations/");
  if (key === "theme") return pathname === "/themes" || pathname.startsWith("/themes/");
  if (key === "planner") return isPlannerPath(pathname);
  if (key === "inquiry") {
    return pathname === "/corporate" || pathname.startsWith("/corporate/");
  }
  if (key === "guides") return pathname.startsWith("/guides");
  if (key === "support") return pathname.startsWith("/support");
  return false;
}

export function DesktopMegaMenu({ primaryNav }: { primaryNav: HeaderPrimaryNavItem[] }) {
  const pathname = usePathname();
  const [tourTypeParam, setTourTypeParam] = useState<string | null>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastOpenKeyRef = useRef<string | null>(null);

  const golfHref = buildGolfProductsHref();
  const golfActive = pathname === "/products" && isGolfTourType(tourTypeParam);
  const catalogItems = useMemo(() => assembleCatalogPrimaryNav(primaryNav), [primaryNav]);

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
      if (e.key === "Escape" && openKey) setOpenKey(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openKey]);

  // 패널(부모 렌더) 언마운트 후 body로 빠진 포커스를 트리거로 복귀
  useEffect(() => {
    if (openKey) {
      lastOpenKeyRef.current = openKey;
      return;
    }
    const key = lastOpenKeyRef.current;
    if (!key) return;
    lastOpenKeyRef.current = null;
    const trigger = document.getElementById(`mega-menu-trigger-${key}`);
    if (!(trigger instanceof HTMLElement)) return;
    const timer = window.setTimeout(() => {
      const active = document.activeElement;
      // 패널 제거로 focus가 문서 body로 떨어진 경우에만 복귀 (외부 클릭 등 다른 포커스 이동은 유지)
      if (active === document.body || active == null) {
        trigger.focus();
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [openKey]);

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
      <nav className="flex shrink-0 items-center gap-x-1 sm:gap-x-2 lg:gap-x-3 xl:gap-x-4" aria-label="탐색 메뉴">
        <Link
          href={golfHref}
          className={getNavLinkClass(golfActive)}
          onClick={() => {
            onClose();
            trackClientEvent(
              createAnalyticsPayload({
                eventName: ANALYTICS_EVENTS.header_nav_click,
                source: ANALYTICS_SOURCES.header_desktop_primary,
                label: "골프여행",
                href: golfHref,
                section: "golf",
                taxonomyType: null,
                position: 0,
                pagePath: typeof window !== "undefined" ? window.location.pathname : null,
                deviceType: inferDeviceType("desktop"),
              }),
            );
          }}
        >
          골프여행
        </Link>
        {catalogItems.map((item, index) => (
          <DesktopNavItem
            key={item.key}
            item={item}
            positionIndex={index + 1}
            isOpen={openKey === item.key}
            onOpen={() => setOpenKey(item.key)}
            onClose={onClose}
            scheduleClose={scheduleClose}
            cancelClose={cancelClose}
            isActive={getIsActive(item, pathname, tourTypeParam)}
            getNavLinkClass={getNavLinkClass}
            renderPanelInParent
          />
        ))}
      </nav>
      {openKey && (() => {
        const item = catalogItems.find((i) => i.key === openKey);
        return item ? <DesktopMegaMenuPanel item={item} onClose={onClose} /> : null;
      })()}
    </div>
  );
}
