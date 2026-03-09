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
  "absolute left-0 top-full z-50 mt-0 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl py-8 px-8 min-h-[360px] mega-menu-panel-enter";

/** 메가메뉴 링크 공통: hover = surface-muted, active = primary-soft + primary + semibold */
const LINK_BASE =
  "block rounded-lg py-2 px-2.5 type-small transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-1";
const LINK_HOVER = "hover:bg-[var(--surface-muted)]";
const LINK_ACTIVE = "bg-[var(--primary-soft)] font-semibold text-[var(--primary)]";
const LINK_DEFAULT = "text-[var(--foreground)] hover:text-[var(--primary)]";

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

  const isGroupActive = (key: string) => activeGroupKey === key || (activeGroupKey === null && key === regionRootGroups[0]?.key);
  const isSubGroupActive = (key: string) =>
    activeSubGroupKey === key || (activeSubGroupKey === null && key === activeGroup?.subGroups?.[0]?.key);

  return (
    <div
      id="mega-menu-panel-region"
      className={cn(PANEL_BASE, "min-w-[900px] w-max")}
      role="menu"
      aria-label="지역별 여행"
      onMouseLeave={() => {
        setActiveGroupKey(null);
        setActiveSubGroupKey(null);
        onClose();
      }}
    >
      <div className="grid grid-cols-[200px_200px_200px_260px] gap-8">
        {/* Column 1: 바로가기 */}
        <div className="space-y-3">
          <p className="px-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">바로가기</p>
          {hubGroup && (
            <ul className="space-y-0.5" role="none">
              {hubGroup.items.map((leaf, i) => (
                <li key={leaf.key} role="none">
                  <Link
                    href={leaf.href}
                    role="menuitem"
                    className={cn(LINK_BASE, LINK_DEFAULT, LINK_HOVER)}
                    onClick={() => onLeafClick(leaf, 0, i)}
                  >
                    {leaf.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Column 2: 권역 (대분류) */}
        <div className="space-y-3 border-l border-[var(--border)] pl-6">
          <p className="px-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">권역</p>
          <ul className="space-y-0.5" role="none">
            {regionRootGroups.map((group) => (
              <li key={group.key} role="none" onMouseEnter={() => setActiveGroupKey(group.key)}>
                {group.labelHref ? (
                  <Link
                    href={group.labelHref}
                    role="menuitem"
                    className={cn(
                      LINK_BASE,
                      isGroupActive(group.key) ? cn(LINK_ACTIVE) : cn(LINK_DEFAULT, LINK_HOVER),
                    )}
                    onClick={() => onLeafClick({ key: group.key, label: group.label, href: group.labelHref! }, -1, -1)}
                  >
                    {group.label}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      LINK_BASE,
                      isGroupActive(group.key) ? LINK_ACTIVE : "text-[var(--foreground)]",
                    )}
                  >
                    {group.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* Column 3: 지역/국가 (중분류: 일본, 동남아, 남미 등) */}
        <div className="space-y-3 border-l border-[var(--border)] pl-6">
          <p className="px-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">지역/국가</p>
          {activeGroup && (
            <ul className="space-y-0.5" role="none">
              {activeGroup.subGroups.map((sub) => (
                <li key={sub.key} role="none" onMouseEnter={() => setActiveSubGroupKey(sub.key)}>
                  {sub.labelHref ? (
                    <Link
                      href={sub.labelHref}
                      role="menuitem"
                      className={cn(
                        LINK_BASE,
                        isSubGroupActive(sub.key) ? cn(LINK_ACTIVE) : cn(LINK_DEFAULT, LINK_HOVER),
                      )}
                      onClick={() => onLeafClick({ key: sub.key, label: sub.label, href: sub.labelHref! }, -1, -1)}
                    >
                      {sub.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        LINK_BASE,
                        isSubGroupActive(sub.key) ? LINK_ACTIVE : "text-[var(--foreground)]",
                      )}
                    >
                      {sub.label}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Column 4: 국가/도시 (소분류: 도쿄, 오키나와, 베트남 등) */}
        <div className="space-y-3 border-l border-[var(--border)] pl-6">
          <p className="px-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">국가/도시</p>
          {activeSubGroup && (
            <ul className="space-y-0.5" role="none">
              {activeSubGroup.items.map((leaf, i) => (
                <li key={leaf.key} role="none">
                  <Link
                    href={leaf.href}
                    role="menuitem"
                    className={cn(LINK_BASE, LINK_DEFAULT, LINK_HOVER)}
                    onClick={() => onLeafClick(leaf, regionRootGroups.indexOf(activeGroup), i)}
                  >
                    {leaf.label}
                  </Link>
                </li>
              ))}
            </ul>
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
      className={cn(PANEL_BASE, "min-w-[520px]")}
      role="menu"
      aria-label={item.label}
      onMouseLeave={onClose}
    >
      <div className="grid grid-cols-2 gap-8">
        {groups.map((group, groupIndex) => (
          <div key={group.key} className="space-y-3">
            {group.labelHref ? (
              <Link
                href={group.labelHref}
                role="menuitem"
                className={cn(LINK_BASE, "font-semibold text-[var(--text-muted)]", LINK_HOVER, "hover:text-[var(--primary)]")}
                onClick={() => {
                  handleLeafClick({ key: group.key, label: group.label, href: group.labelHref! }, groupIndex, -1);
                }}
              >
                {group.label}
              </Link>
            ) : (
              <p className="px-2.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
                {group.label}
              </p>
            )}
            <ul className="space-y-0.5" role="none">
              {group.items.map((leaf, itemIndex) => (
                <li key={leaf.key} role="none">
                  <Link
                    href={leaf.href}
                    role="menuitem"
                    className={cn(LINK_BASE, LINK_DEFAULT, LINK_HOVER)}
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
