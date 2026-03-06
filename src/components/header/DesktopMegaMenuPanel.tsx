"use client";

import Link from "next/link";
import type { HeaderPrimaryNavItem, HeaderNavLeafItem } from "./headerNav.types";
import { cn } from "@/lib/cn";
import { trackClientEvent } from "@/lib/analytics/trackClientEvent";
import { createAnalyticsPayload, inferDeviceType } from "@/lib/analytics/payload";
import { ANALYTICS_EVENTS, ANALYTICS_SOURCES } from "@/lib/analytics/events";

type DesktopMegaMenuPanelProps = {
  item: HeaderPrimaryNavItem;
  onClose: () => void;
};

function inferTaxonomyTypeFromKey(key: string): "category" | "theme" | null {
  if (key === "region") return "category";
  if (key === "theme") return "theme";
  return null;
}

function extractSlugFromHref(href: string): string | null {
  const m = href.match(/^\/products\/(region|theme)\/([^/?#]+)/);
  return m ? decodeURIComponent(m[2]) : null;
}

export function DesktopMegaMenuPanel({
  item,
  onClose,
}: DesktopMegaMenuPanelProps) {
  const groups = item.groups ?? [];
  const taxonomyType = inferTaxonomyTypeFromKey(item.key);

  const handleLeafClick = (leaf: HeaderNavLeafItem, groupIndex: number, itemIndex: number) => {
    const position = groupIndex * 100 + itemIndex;
    const payload = createAnalyticsPayload({
      eventName: ANALYTICS_EVENTS.mega_menu_click,
      source: ANALYTICS_SOURCES.header_desktop_panel,
      section: item.key,
      label: leaf.label,
      href: leaf.href ?? null,
      taxonomyType,
      taxonomySlug: leaf.href ? extractSlugFromHref(leaf.href) : null,
      position,
      pagePath: typeof window !== "undefined" ? window.location.pathname : null,
      deviceType: inferDeviceType("desktop"),
    });
    trackClientEvent(payload);
    onClose();
  };

  return (
    <div
      id={`mega-menu-panel-${item.key}`}
      className={cn(
        "absolute left-0 top-full z-50 mt-0 min-w-[280px] max-w-[520px]",
        "rounded-b-xl border border-t-0 border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft-strong)]",
        "py-4 px-4",
      )}
      role="menu"
      aria-label={item.label}
      onMouseLeave={onClose}
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {groups.map((group, groupIndex) => (
          <div key={group.key} className="space-y-2">
            <p className="type-small font-semibold text-[var(--text-muted)]">
              {group.label}
            </p>
            <ul className="space-y-1" role="none">
              {group.items.map((leaf, itemIndex) => (
                <li key={leaf.key} role="none">
                  <Link
                    href={leaf.href}
                    role="menuitem"
                    className={cn(
                      "block rounded-md py-1.5 px-2 type-small text-[var(--foreground)]",
                      "hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1",
                    )}
                    onClick={() => handleLeafClick(leaf, groupIndex, itemIndex)}
                  >
                    {leaf.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
