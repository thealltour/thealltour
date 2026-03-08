"use client";

import Link from "next/link";
import { useRef, useCallback } from "react";
import { ChevronDown } from "lucide-react";
import type { HeaderPrimaryNavItem } from "./headerNav.types";
import { DesktopMegaMenuPanel } from "./DesktopMegaMenuPanel";
import { cn } from "@/lib/cn";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

type DesktopNavItemProps = {
  item: HeaderPrimaryNavItem;
  positionIndex?: number;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  isActive: boolean;
  getNavLinkClass: (isActive: boolean) => string;
};

export function DesktopNavItem({
  item,
  positionIndex,
  isOpen,
  onOpen,
  onClose,
  isActive,
  getNavLinkClass,
}: DesktopNavItemProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const hasPanel = Boolean(item.groups && item.groups.length > 0);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose],
  );

  const handleBlur = useCallback(() => {
    requestAnimationFrame(() => {
      if (wrapperRef.current && !wrapperRef.current.contains(document.activeElement)) {
        onClose();
      }
    });
  }, [onClose]);

  if (!hasPanel && item.href) {
    return (
      <Link
        href={item.href}
        className={getNavLinkClass(isActive)}
        onClick={() => {
          const payload = createAnalyticsPayload({
            eventName: ANALYTICS_EVENTS.header_nav_click,
            source: ANALYTICS_SOURCES.header_desktop_primary,
            label: item.label,
            href: item.href ?? null,
            section: item.key,
            taxonomyType: null,
            position: positionIndex ?? null,
            pagePath: typeof window !== "undefined" ? window.location.pathname : null,
            deviceType: inferDeviceType("desktop"),
          });
          trackClientEvent(payload);
        }}
      >
        {item.label}
      </Link>
    );
  }

  if (hasPanel && item.href) {
    return (
      <div
        ref={wrapperRef}
        className="relative flex items-center gap-0.5"
        onMouseEnter={onOpen}
        onMouseLeave={onClose}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      >
        <Link
          href={item.href}
          className={getNavLinkClass(isActive || isOpen)}
          onClick={() => {
            const payload = createAnalyticsPayload({
              eventName: ANALYTICS_EVENTS.header_nav_click,
              source: ANALYTICS_SOURCES.header_desktop_primary,
              label: item.label,
              href: item.href ?? null,
              section: item.key,
              taxonomyType: null,
              position: positionIndex ?? null,
              pagePath: typeof window !== "undefined" ? window.location.pathname : null,
              deviceType: inferDeviceType("desktop"),
            });
            trackClientEvent(payload);
          }}
        >
          {item.label}
        </Link>
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={isOpen}
          aria-haspopup="true"
          aria-label={`${item.label} 하위 메뉴 열기`}
          aria-controls={isOpen ? `mega-menu-panel-${item.key}` : undefined}
          id={`mega-menu-trigger-${item.key}`}
          className={cn(
            "flex shrink-0 items-center justify-center rounded p-0.5 text-[var(--text-muted)] transition-colors",
            "hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:rounded",
          )}
          onClick={(e) => {
            e.preventDefault();
            if (isOpen) onClose();
            else {
              if (typeof window !== "undefined") {
                const payload = createAnalyticsPayload({
                  eventName: ANALYTICS_EVENTS.mega_menu_open,
                  source: ANALYTICS_SOURCES.header_desktop_primary,
                  section: item.key,
                  label: item.label,
                  position: positionIndex ?? null,
                  pagePath: window.location.pathname,
                  deviceType: inferDeviceType("desktop"),
                });
                trackClientEvent(payload);
              }
              onOpen();
            }
          }}
          onFocus={onOpen}
        >
          <ChevronDown className="h-4 w-4" aria-hidden />
        </button>
        {isOpen && (
          <DesktopMegaMenuPanel item={item} onClose={onClose} />
        )}
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={onOpen}
      onMouseLeave={onClose}
      onKeyDown={handleKeyDown}
      onBlur={handleBlur}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="true"
        aria-controls={isOpen ? `mega-menu-panel-${item.key}` : undefined}
        id={`mega-menu-trigger-${item.key}`}
        className={cn(
          "relative shrink-0 whitespace-nowrap type-nav transition-colors duration-150 py-1 px-0.5 rounded border-0 bg-transparent cursor-pointer text-left",
          isActive || isOpen
            ? cn(
                "text-[var(--foreground)] font-semibold",
                "after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[var(--primary)]",
              )
            : cn(
                "text-[var(--text-muted)]",
                "hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
              ),
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:rounded",
        )}
        onClick={(e) => {
          e.preventDefault();
          if (isOpen) onClose();
          else {
            if (typeof window !== "undefined") {
              const payload = createAnalyticsPayload({
                eventName: ANALYTICS_EVENTS.mega_menu_open,
                source: ANALYTICS_SOURCES.header_desktop_primary,
                section: item.key,
                label: item.label,
                position: positionIndex ?? null,
                pagePath: window.location.pathname,
                deviceType: inferDeviceType("desktop"),
              });
              trackClientEvent(payload);
            }
            onOpen();
          }
        }}
        onFocus={onOpen}
      >
        {item.label}
      </button>
      {hasPanel && isOpen && (
        <DesktopMegaMenuPanel item={item} onClose={onClose} />
      )}
    </div>
  );
}
