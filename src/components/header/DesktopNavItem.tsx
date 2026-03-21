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
  /** 부모에서 관리하는 닫기 지연. 다른 메뉴로 이동 시 대기 중인 닫기가 취소되도록 함 */
  scheduleClose?: () => void;
  cancelClose?: () => void;
  /** true면 패널은 부모(DesktopMegaMenu)에서 렌더링. 트리거만 렌더하고, leave 시 scheduleClose 호출하지 않음 */
  renderPanelInParent?: boolean;
  isActive: boolean;
  getNavLinkClass: (isActive: boolean) => string;
};

export function DesktopNavItem({
  item,
  positionIndex,
  isOpen,
  onOpen,
  onClose,
  scheduleClose: scheduleCloseProp,
  cancelClose: cancelCloseProp,
  renderPanelInParent = false,
  isActive,
  getNavLinkClass,
}: DesktopNavItemProps) {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const hasPanel = Boolean(item.groups && item.groups.length > 0);

  const scheduleClose = scheduleCloseProp ?? onClose;
  const cancelClose = cancelCloseProp ?? (() => {});
  const handleMouseLeave = renderPanelInParent ? undefined : scheduleClose;

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
        onMouseEnter={() => {
          cancelClose();
          onOpen();
        }}
        onMouseLeave={handleMouseLeave}
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
          <ChevronDown className="h-3.5 w-3.5" aria-hidden />
        </button>
        {!renderPanelInParent && isOpen && (
          <DesktopMegaMenuPanel item={item} onClose={onClose} />
        )}
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => {
        cancelClose();
        onOpen();
      }}
      onMouseLeave={handleMouseLeave}
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
          "relative shrink-0 whitespace-nowrap text-sm lg:text-[15px] lg:leading-snug tracking-tight transition-colors duration-150 py-1.5 px-2.5 rounded-lg border-0 bg-transparent cursor-pointer text-left",
          isActive || isOpen
            ? cn("bg-[var(--primary-soft)] font-medium text-[var(--primary)]")
            : cn(
                "font-normal text-[var(--text-muted)]",
                "hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)]",
              ),
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 focus-visible:rounded-lg",
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
      {!renderPanelInParent && hasPanel && isOpen && (
        <DesktopMegaMenuPanel item={item} onClose={onClose} />
      )}
    </div>
  );
}
