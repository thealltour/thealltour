"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { HeaderPrimaryNavItem, HeaderNavLeafItem, HeaderNavGroup, HeaderNavSubGroup } from "./headerNav.types";
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
  const [expandedNestedKeys, setExpandedNestedKeys] = useState<Set<string>>(new Set());

  const toggleNested = useCallback((compositeKey: string) => {
    setExpandedNestedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(compositeKey)) next.delete(compositeKey);
      else next.add(compositeKey);
      return next;
    });
  }, []);

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

  /** 지역별/테마별처럼 subGroups가 있을 때: 해외·국내(1단계), 일본·동남아(2단계) 접기/펼치기 */
  function renderGroupsPanelContent(
    item: HeaderPrimaryNavItem,
    groups: (HeaderNavGroup & { subGroups?: HeaderNavSubGroup[] })[],
  ) {
    return (
      <ul className="flex flex-col border-t border-[var(--divider)] bg-[var(--surface-muted)] pb-2">
        {groups.map((group) => {
          const isHub = group.key === "region-hub" || group.key === "theme-hub";
          if (isHub) {
            return (
              <li key={group.key} className="space-y-0.5 pt-2">
                {group.items.map((leaf) => (
                  <Link
                    key={leaf.key}
                    href={leaf.href}
                    onClick={() => onNavigate?.()}
                    className="block py-2 pl-4 pr-4 type-small font-medium text-[var(--foreground)] active:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
                  >
                    {leaf.label}
                  </Link>
                ))}
              </li>
            );
          }
          if (group.subGroups && group.subGroups.length > 0) {
            const groupCompositeKey = `${item.key}:${group.key}`;
            const isGroupExpanded = expandedNestedKeys.has(groupCompositeKey);
            return (
              <li key={group.key} className="border-t border-[var(--divider)]/50 first:border-t-0">
                <div className="flex w-full items-center justify-between gap-2 py-3 pl-4 pr-4">
                  {group.labelHref ? (
                    <Link
                      href={group.labelHref}
                      onClick={() => onNavigate?.()}
                      className={cn(
                        "flex-1 type-caption font-semibold text-[var(--foreground)] active:text-[var(--primary)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset rounded",
                      )}
                    >
                      {group.label}
                    </Link>
                  ) : (
                    <span className="flex-1 type-caption font-semibold text-[var(--foreground)]">{group.label}</span>
                  )}
                  <button
                    type="button"
                    aria-expanded={isGroupExpanded}
                    aria-label={isGroupExpanded ? `${group.label} 접기` : `${group.label} 펼치기`}
                    onClick={() => toggleNested(groupCompositeKey)}
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded p-1.5 text-[var(--text-muted)]",
                      "active:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset",
                    )}
                  >
                    <ChevronDown
                      className={cn("h-4 w-4 shrink-0 transition-transform", isGroupExpanded && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                </div>
                {isGroupExpanded && (
                  <ul className="flex flex-col bg-[var(--surface)]/50 pb-1">
                    {group.subGroups.map((sub) => {
                      const subCompositeKey = `${item.key}:${group.key}:${sub.key}`;
                      const isSubExpanded = expandedNestedKeys.has(subCompositeKey);
                      return (
                        <li key={sub.key}>
                          <div className="flex w-full items-center justify-between gap-2 py-2.5 pl-6 pr-4">
                            {sub.labelHref ? (
                              <Link
                                href={sub.labelHref}
                                onClick={() => onNavigate?.()}
                                className={cn(
                                  "flex-1 type-caption font-medium text-[var(--text-muted)] active:text-[var(--primary)]",
                                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset rounded",
                                )}
                              >
                                {sub.label}
                              </Link>
                            ) : (
                              <span className="flex-1 type-caption font-medium text-[var(--text-muted)]">{sub.label}</span>
                            )}
                            <button
                              type="button"
                              aria-expanded={isSubExpanded}
                              aria-label={isSubExpanded ? `${sub.label} 접기` : `${sub.label} 펼치기`}
                              onClick={() => toggleNested(subCompositeKey)}
                              className={cn(
                                "flex shrink-0 items-center justify-center rounded p-1.5 text-[var(--text-muted)]",
                                "active:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset",
                              )}
                            >
                              <ChevronDown
                                className={cn("h-4 w-4 shrink-0 transition-transform", isSubExpanded && "rotate-180")}
                                aria-hidden
                              />
                            </button>
                          </div>
                          {isSubExpanded && (
                            <ul className="flex flex-col">
                              {sub.items.map((leaf) => (
                                <li key={leaf.key}>
                                  <Link
                                    href={leaf.href}
                                    onClick={() => handleLeafClick(item, leaf)}
                                    className="block py-2 pl-8 pr-4 type-small text-[var(--foreground)] transition-colors active:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
                                  >
                                    {leaf.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          }
          return (
            <li key={group.key}>
              {group.labelHref ? (
                <Link
                  href={group.labelHref}
                  onClick={() => onNavigate?.()}
                  className="block px-4 pt-3 pb-1.5 type-caption font-semibold text-[var(--text-muted)] active:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset"
                >
                  {group.label}
                </Link>
              ) : (
                <span className="block px-4 pt-3 pb-1.5 type-caption font-semibold text-[var(--text-muted)]">
                  {group.label}
                </span>
              )}
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
          );
        })}
      </ul>
    );
  }

  return (
    <nav className="flex flex-col" aria-label="모바일 메뉴">
      <ul className="flex flex-col">
        {items.map((item) => {
          const hasGroups = item.groups && item.groups.length > 0;
          const isExpanded = expandedKey === item.key;

          if (hasGroups && item.href) {
            return (
              <li key={item.key} className="border-b border-[var(--divider)]">
                <div className="flex w-full items-center gap-1 pr-4 pl-4">
                  <Link
                    href={item.href}
                    onClick={() => {
                      handleDirectLinkClick(item.key, item.label, item.href!);
                    }}
                    className={cn(
                      "flex flex-1 items-center py-4 text-left type-small font-semibold text-[var(--foreground)]",
                      "active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset",
                    )}
                  >
                    {item.label}
                  </Link>
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={`mobile-nav-panel-${item.key}`}
                    id={`mobile-nav-trigger-${item.key}`}
                    aria-label={`${item.label} 하위 메뉴 ${isExpanded ? "접기" : "펼치기"}`}
                    onClick={() => onToggle(item.key)}
                    className={cn(
                      "flex shrink-0 items-center justify-center rounded p-2 text-[var(--text-muted)]",
                      "active:bg-[var(--surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset",
                    )}
                  >
                    <ChevronDown
                      className={cn("h-5 w-5 shrink-0 transition-transform", isExpanded && "rotate-180")}
                      aria-hidden
                    />
                  </button>
                </div>
                <div
                  id={`mobile-nav-panel-${item.key}`}
                  role="region"
                  aria-labelledby={`mobile-nav-trigger-${item.key}`}
                  className={cn("overflow-hidden transition-[height] duration-200 ease-out", isExpanded ? "visible" : "hidden")}
                >
                  {item.groups!.some((g) => g.subGroups && g.subGroups.length > 0)
                    ? renderGroupsPanelContent(item, item.groups!)
                    : (
                  <ul className="flex flex-col border-t border-[var(--divider)] bg-[var(--surface-muted)] pb-2">
                    {item.groups!.map((group) => (
                      <li key={group.key}>
                        {group.subGroups?.length ? (
                          <>
                            {group.labelHref ? (
                              <Link href={group.labelHref} onClick={() => onNavigate?.()} className="block px-4 pt-3 pb-1.5 type-caption font-semibold text-[var(--text-muted)] active:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset">{group.label}</Link>
                            ) : (
                              <span className="block px-4 pt-3 pb-1.5 type-caption font-semibold text-[var(--text-muted)]">{group.label}</span>
                            )}
                            {group.subGroups.map((sub) => (
                              <ul key={sub.key} className="flex flex-col">
                                <li>
                                  {sub.labelHref ? (
                                    <Link href={sub.labelHref} onClick={() => onNavigate?.()} className="block py-2 pl-6 pr-4 type-caption font-medium text-[var(--text-muted)] active:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset">{sub.label}</Link>
                                  ) : (
                                    <span className="block py-2 pl-6 pr-4 type-caption font-medium text-[var(--text-muted)]">{sub.label}</span>
                                  )}
                                </li>
                                {sub.items.map((leaf) => (
                                  <li key={leaf.key}>
                                    <Link href={leaf.href} onClick={() => handleLeafClick(item, leaf)} className="block py-2 pl-8 pr-4 type-small text-[var(--foreground)] transition-colors active:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset">{leaf.label}</Link>
                                  </li>
                                ))}
                              </ul>
                            ))}
                          </>
                        ) : (
                          <>
                            {group.labelHref ? (
                              <Link href={group.labelHref} onClick={() => onNavigate?.()} className="block px-4 pt-3 pb-1.5 type-caption font-semibold text-[var(--text-muted)] active:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset">{group.label}</Link>
                            ) : (
                              <span className="block px-4 pt-3 pb-1.5 type-caption font-semibold text-[var(--text-muted)]">{group.label}</span>
                            )}
                            <ul className="flex flex-col">
                              {group.items.map((leaf) => (
                                <li key={leaf.key}>
                                  <Link href={leaf.href} onClick={() => handleLeafClick(item, leaf)} className="block py-2 pl-6 pr-4 type-small text-[var(--foreground)] transition-colors active:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset">{leaf.label}</Link>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                    )}
                </div>
              </li>
            );
          }

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
                  {item.groups!.some((g) => g.subGroups && g.subGroups.length > 0)
                    ? renderGroupsPanelContent(item, item.groups!)
                    : (
                  <ul className="flex flex-col border-t border-[var(--divider)] bg-[var(--surface-muted)] pb-2">
                    {item.groups!.map((group) => (
                      <li key={group.key}>
                        {group.subGroups?.length ? (
                          <>
                            {group.labelHref ? (
                              <Link href={group.labelHref} onClick={() => onNavigate?.()} className="block px-4 pt-3 pb-1.5 type-caption font-semibold text-[var(--text-muted)] active:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset">{group.label}</Link>
                            ) : (
                              <span className="block px-4 pt-3 pb-1.5 type-caption font-semibold text-[var(--text-muted)]">{group.label}</span>
                            )}
                            {group.subGroups.map((sub) => (
                              <ul key={sub.key} className="flex flex-col">
                                <li>
                                  {sub.labelHref ? (
                                    <Link href={sub.labelHref} onClick={() => onNavigate?.()} className="block py-2 pl-6 pr-4 type-caption font-medium text-[var(--text-muted)] active:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset">{sub.label}</Link>
                                  ) : (
                                    <span className="block py-2 pl-6 pr-4 type-caption font-medium text-[var(--text-muted)]">{sub.label}</span>
                                  )}
                                </li>
                                {sub.items.map((leaf) => (
                                  <li key={leaf.key}>
                                    <Link href={leaf.href} onClick={() => handleLeafClick(item, leaf)} className="block py-2 pl-8 pr-4 type-small text-[var(--foreground)] transition-colors active:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset">{leaf.label}</Link>
                                  </li>
                                ))}
                              </ul>
                            ))}
                          </>
                        ) : (
                          <>
                            {group.labelHref ? (
                              <Link href={group.labelHref} onClick={() => onNavigate?.()} className="block px-4 pt-3 pb-1.5 type-caption font-semibold text-[var(--text-muted)] active:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset">{group.label}</Link>
                            ) : (
                              <span className="block px-4 pt-3 pb-1.5 type-caption font-semibold text-[var(--text-muted)]">{group.label}</span>
                            )}
                            <ul className="flex flex-col">
                              {group.items.map((leaf) => (
                                <li key={leaf.key}>
                                  <Link href={leaf.href} onClick={() => handleLeafClick(item, leaf)} className="block py-2 pl-6 pr-4 type-small text-[var(--foreground)] transition-colors active:bg-[var(--surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-inset">{leaf.label}</Link>
                                </li>
                              ))}
                            </ul>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                    )}
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
