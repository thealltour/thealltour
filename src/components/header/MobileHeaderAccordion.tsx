"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { HeaderPrimaryNavItem, HeaderNavLeafItem } from "./headerNav.types";
import { cn } from "@/lib/cn";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

function inferTaxonomyTypeFromKey(key: string): "category" | "theme" | null {
  if (key === "region") return "category";
  if (key === "theme") return "theme";
  return null;
}

function extractSlugFromHref(href: string): string | null {
  const m = href.match(/^\/products\/(region|theme)\/([^/?#]+)/);
  return m ? decodeURIComponent(m[2]) : null;
}

export type MobileHeaderAccordionProps = {
  items: HeaderPrimaryNavItem[];
  expandedKey: string | null;
  onToggle: (key: string) => void;
  onNavigate?: () => void;
};

export function MobileHeaderAccordion({
  items,
  expandedKey,
  onToggle,
  onNavigate,
}: MobileHeaderAccordionProps) {
  const handleLeafClick = (item: HeaderPrimaryNavItem, leaf: HeaderNavLeafItem) => {
    const taxonomyType = inferTaxonomyTypeFromKey(item.key);
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.mobile_menu_click,
        source: ANALYTICS_SOURCES.header_mobile_accordion,
        section: item.key,
        label: leaf.label,
        href: leaf.href ?? null,
        taxonomyType,
        taxonomySlug: leaf.href ? extractSlugFromHref(leaf.href) : null,
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("mobile"),
      }),
    );
    onNavigate?.();
  };

  const handleDirectLinkClick = (section: string, label: string, href: string) => {
    trackClientEvent(
      createAnalyticsPayload({
        eventName: ANALYTICS_EVENTS.mobile_menu_click,
        source: ANALYTICS_SOURCES.header_mobile_accordion,
        section,
        label,
        href,
        pagePath: typeof window !== "undefined" ? window.location.pathname : null,
        deviceType: inferDeviceType("mobile"),
      }),
    );
    onNavigate?.();
  };

  return (
    <nav className="flex flex-col" aria-label="모바일 메뉴">
      <ul className="flex flex-col">
        {items.map((item) => {
          const hasGroups = item.groups && item.groups.length > 0;
          const isExpanded = expandedKey === item.key;

          if (hasGroups) {
            return (
              <li key={item.key} className="border-b border-[var(--divider)]">
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-controls={`mobile-nav-panel-${item.key}`}
                  id={`mobile-nav-trigger-${item.key}`}
                  onClick={() => onToggle(item.key)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 py-4 pr-4 pl-4 text-left type-small font-semibold text-[var(--foreground)]",
                    "active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset",
                  )}
                >
                  <span>{item.label}</span>
                  <ChevronDown
                    className={cn("h-5 w-5 shrink-0 text-[var(--text-muted)] transition-transform", isExpanded && "rotate-180")}
                    aria-hidden
                  />
                </button>
                <div
                  id={`mobile-nav-panel-${item.key}`}
                  role="region"
                  aria-labelledby={`mobile-nav-trigger-${item.key}`}
                  className={cn("overflow-hidden transition-[height] duration-200 ease-out", isExpanded ? "visible" : "hidden")}
                >
                  <ul className="flex flex-col border-t border-[var(--divider)] bg-[var(--surface-muted)] pb-2">
                    {item.groups!.map((group) => (
                      <li key={group.key}>
                        <span className="block px-4 pt-3 pb-1.5 type-caption font-semibold text-[var(--text-muted)]">
                          {group.label}
                        </span>
                        <ul className="flex flex-col">
                          {group.items.map((leaf) => (
                            <li key={leaf.key}>
                              <Link
                                href={leaf.href}
                                onClick={() => handleLeafClick(item, leaf)}
                                className="block py-2 pl-6 pr-4 type-small text-[var(--foreground)] transition-colors active:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
                              >
                                {leaf.label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          }

          if (item.href) {
            return (
              <li key={item.key} className="border-b border-[var(--divider)]">
                <Link
                  href={item.href}
                  onClick={() => handleDirectLinkClick(item.key, item.label, item.href!)}
                  className={cn(
                    "flex w-full items-center py-4 pr-4 pl-4 type-small font-semibold text-[var(--foreground)]",
                    "active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            );
          }

          return null;
        })}
        <li className="border-b border-[var(--divider)]">
          <Link
            href="/about"
            onClick={() => handleDirectLinkClick("about", "회사소개", "/about")}
            className={cn(
              "flex w-full items-center py-4 pr-4 pl-4 type-small font-semibold text-[var(--foreground)]",
              "active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset",
            )}
          >
            회사소개
          </Link>
        </li>
      </ul>
    </nav>
  );
}
