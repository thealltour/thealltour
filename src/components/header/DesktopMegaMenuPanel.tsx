"use client";

import { useState } from "react";
import Link from "next/link";
import type { HeaderPrimaryNavItem, HeaderNavLeafItem, HeaderNavGroup, HeaderNavSubGroup } from "./headerNav.types";
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
  const productsMatch = href.match(/^\/products\/(region|theme)\/([^/?#]+)/);
  if (productsMatch) return decodeURIComponent(productsMatch[2]);
  const hubMatch = href.match(/^\/(destinations|themes)\/([^/?#]+)/);
  if (hubMatch) return decodeURIComponent(hubMatch[2]);
  return null;
}

const PANEL_BASE =
  "absolute left-0 top-full z-50 mt-0 min-w-[280px] max-w-[520px] rounded-b-xl border border-t-0 border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft-strong)] py-4 px-4";

type RegionCascadePanelProps = {
  hubGroup: HeaderNavGroup | undefined;
  regionRootGroups: (HeaderNavGroup & { subGroups: HeaderNavSubGroup[] })[];
  taxonomyType: "category" | "theme" | null;
  onLeafClick: (leaf: HeaderNavLeafItem, groupIndex: number, itemIndex: number) => void;
  onClose: () => void;
  extractSlugFromHref: (href: string) => string | null;
};

function RegionCascadePanel({
  hubGroup,
  regionRootGroups,
  onLeafClick,
  onClose,
}: RegionCascadePanelProps) {
  const [activeGroupKey, setActiveGroupKey] = useState<string | null>(null);
  const [activeSubGroupKey, setActiveSubGroupKey] = useState<string | null>(null);

  const activeGroup = regionRootGroups.find((g) => g.key === activeGroupKey) ?? regionRootGroups[0];
  const activeSubGroup =
    activeGroup?.subGroups?.find((s) => s.key === activeSubGroupKey) ?? activeGroup?.subGroups?.[0] ?? null;

  return (
    <div
      id="mega-menu-panel-region"
      className={cn(PANEL_BASE, "min-w-[420px] max-w-[720px] w-max")}
      role="menu"
      aria-label="지역별 여행"
      onMouseLeave={() => {
        setActiveGroupKey(null);
        setActiveSubGroupKey(null);
        onClose();
      }}
    >
      <div className="grid grid-cols-[auto_1fr_1fr] gap-6">
        <div className="space-y-4 min-w-[140px]">
          {hubGroup && (
            <div className="space-y-1">
              <p className="type-small font-semibold text-[var(--text-muted)] px-2">지역별 여행</p>
              <ul className="space-y-0.5" role="none">
                {hubGroup.items.map((leaf, i) => (
                  <li key={leaf.key} role="none">
                    <Link
                      href={leaf.href}
                      role="menuitem"
                      className={cn(
                        "block rounded-md py-1.5 px-2 type-small text-[var(--foreground)]",
                        "hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1",
                      )}
                      onClick={() => onLeafClick(leaf, 0, i)}
                    >
                      {leaf.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="border-t border-[var(--border)] pt-3 space-y-0.5">
            {regionRootGroups.map((group) => (
              <div key={group.key} onMouseEnter={() => setActiveGroupKey(group.key)}>
                {group.labelHref ? (
                  <Link
                    href={group.labelHref}
                    role="menuitem"
                    className={cn(
                      "block rounded-md py-1.5 px-2 type-small font-medium",
                      activeGroupKey === group.key
                        ? "bg-[var(--surface-muted)] text-[var(--primary)]"
                        : "text-[var(--foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1",
                    )}
                    onClick={() => onLeafClick({ key: group.key, label: group.label, href: group.labelHref! }, -1, -1)}
                  >
                    {group.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      "block rounded-md py-1.5 px-2 type-small font-medium",
                      activeGroupKey === group.key ? "bg-[var(--surface-muted)] text-[var(--primary)]" : "text-[var(--foreground)]",
                    )}
                  >
                    {group.label}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1 min-w-[160px] border-l border-[var(--border)] pl-4">
          {activeGroup && (
            <>
              <p className="type-small font-semibold text-[var(--text-muted)] px-2">{activeGroup.label}</p>
              <ul className="space-y-0.5" role="none">
                {activeGroup.subGroups.map((sub) => (
                  <li key={sub.key} role="none" onMouseEnter={() => setActiveSubGroupKey(sub.key)}>
                    {sub.labelHref ? (
                      <Link
                        href={sub.labelHref}
                        role="menuitem"
                        className={cn(
                          "block rounded-md py-1.5 px-2 type-small",
                          activeSubGroupKey === sub.key
                            ? "bg-[var(--surface-muted)] text-[var(--primary)] font-medium"
                            : "text-[var(--foreground)] hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1",
                        )}
                        onClick={() => onLeafClick({ key: sub.key, label: sub.label, href: sub.labelHref! }, -1, -1)}
                      >
                        {sub.label}
                      </Link>
                    ) : (
                      <span
                        className={cn(
                          "block rounded-md py-1.5 px-2 type-small",
                          activeSubGroupKey === sub.key ? "bg-[var(--surface-muted)] text-[var(--primary)] font-medium" : "text-[var(--foreground)]",
                        )}
                      >
                        {sub.label}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="space-y-1 min-w-[160px] border-l border-[var(--border)] pl-4">
          {activeSubGroup && (
            <>
              <p className="type-small font-semibold text-[var(--text-muted)] px-2">{activeSubGroup.label}</p>
              <ul className="space-y-0.5" role="none">
                {activeSubGroup.items.map((leaf, i) => (
                  <li key={leaf.key} role="none">
                    <Link
                      href={leaf.href}
                      role="menuitem"
                      className={cn(
                        "block rounded-md py-1.5 px-2 type-small text-[var(--foreground)]",
                        "hover:bg-[var(--surface-muted)] hover:text-[var(--primary)]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1",
                      )}
                      onClick={() => onLeafClick(leaf, regionRootGroups.indexOf(activeGroup), i)}
                    >
                      {leaf.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
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

  const isRegion = item.key === "region";
  const regionRootGroups = groups.filter((g): g is HeaderNavGroup & { subGroups: HeaderNavSubGroup[] } =>
    Boolean(g.subGroups && g.subGroups.length > 0),
  );
  const hubGroup = groups.find((g) => g.key === "region-hub");
  const useRegionCascade = isRegion && regionRootGroups.length > 0;

  if (useRegionCascade) {
    return (
      <RegionCascadePanel
        hubGroup={hubGroup}
        regionRootGroups={regionRootGroups}
        taxonomyType={taxonomyType}
        onLeafClick={handleLeafClick}
        onClose={onClose}
        extractSlugFromHref={extractSlugFromHref}
      />
    );
  }

  return (
    <div
      id={`mega-menu-panel-${item.key}`}
      className={PANEL_BASE}
      role="menu"
      aria-label={item.label}
      onMouseLeave={onClose}
    >
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {groups.map((group, groupIndex) => (
          <div key={group.key} className="space-y-2">
            {group.labelHref ? (
              <Link
                href={group.labelHref}
                role="menuitem"
                className={cn(
                  "block type-small font-semibold text-[var(--text-muted)]",
                  "hover:text-[var(--primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1 rounded px-2 py-0.5 -mx-2",
                )}
                onClick={() => {
                  handleLeafClick({ key: group.key, label: group.label, href: group.labelHref! }, groupIndex, -1);
                }}
              >
                {group.label}
              </Link>
            ) : (
              <p className="type-small font-semibold text-[var(--text-muted)] px-2">
                {group.label}
              </p>
            )}
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
