"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { MainMenuKey } from "@/components/admin/SubHeader";
import { useAdminSession } from "@/components/admin/AdminRoleContext";
import {
  SIDEBAR_WIDTH_COLLAPSED_PX,
  SIDEBAR_WIDTH_EXPANDED_PX,
  useSidebarCollapse,
} from "@/components/admin/SidebarCollapseContext";
import { SIDEBAR_GROUPS, SIDEBAR_ITEMS } from "@/components/admin/sidebarConfig";
import { confirmAdminProductUnsavedIfNeeded } from "@/components/admin/products/editor/hooks/useUnsavedChangesGuard";
import { ThemedWordmarkImage } from "@/components/header/ThemedWordmarkImage";
import { isReviewRelatedPath } from "@/components/admin/sidebarUtils";
import { canAccessSidebarMainKey } from "@/lib/adminRolePolicy";
import { hasAdminPermission } from "@/lib/adminPermissions";
import { THEALL_FAVICON_32_SRC } from "@/lib/brandAssets";

type SidebarProps = {
  activeMenu: MainMenuKey | null;
  setActiveMenu: (key: MainMenuKey) => void;
};

function memberRewardsHref(session: ReturnType<typeof useAdminSession>) {
  if (hasAdminPermission(session, "members.manage")) {
    return "/theall_manager_only/members";
  }
  if (hasAdminPermission(session, "points.manage")) {
    return "/theall_manager_only/points";
  }
  return "/theall_manager_only/rewards";
}

export default function Sidebar({ activeMenu, setActiveMenu }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useAdminSession();
  const { isCollapsed, setIsCollapsed } = useSidebarCollapse();
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    ops: true,
    catalog: true,
    content: true,
  });

  function toggleGroup(groupId: string) {
    setExpandedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }

  function isItemActive(href: string, mainKey?: MainMenuKey): boolean {
    if (mainKey && activeMenu === mainKey) return true;
    if (mainKey === "reviews" && isReviewRelatedPath(pathname)) return true;
    if (href === "/theall_manager_only") return pathname === "/theall_manager_only";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-300"
      style={{ width: isCollapsed ? `${SIDEBAR_WIDTH_COLLAPSED_PX}px` : `${SIDEBAR_WIDTH_EXPANDED_PX}px` }}
    >
      <div className="flex h-full flex-col">
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-2 px-2 pt-6 pb-4">
            <Link href="/" className="inline-flex items-center justify-center" title="thealltour">
              <Image
                src={THEALL_FAVICON_32_SRC}
                alt="thealltour"
                width={32}
                height={32}
                className="h-8 w-8 rounded-md object-contain"
              />
            </Link>
            <button
              type="button"
              aria-label="Expand sidebar"
              onClick={() => setIsCollapsed(false)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] shadow-sm transition-colors duration-150 hover:bg-[var(--surface-muted)]"
            >
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between px-4 pt-6 pb-4">
            <Link href="/" className="inline-flex min-w-0 items-center">
              <ThemedWordmarkImage
                sizes="120px"
                imgClassName="h-auto w-[120px] max-w-full object-contain object-left"
              />
            </Link>
            <button
              type="button"
              aria-label="Collapse sidebar"
              onClick={() => setIsCollapsed(true)}
              className="ml-2 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-[var(--text-muted)] shadow-sm transition-colors duration-150 hover:bg-[var(--surface-muted)]"
            >
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}
        {!isCollapsed && (
          <p className="px-4 pb-4 text-xs font-semibold tracking-[0.18em] text-[var(--brand)]">
            THEALL TOUR ADMIN
          </p>
        )}

        <nav className="flex-1 space-y-2 overflow-y-auto px-2 pb-4">
          {SIDEBAR_GROUPS.map((group) => {
            const groupItems = SIDEBAR_ITEMS.filter(
              (item) =>
                item.group === group.id &&
                item.mainKey &&
                canAccessSidebarMainKey(session, item.mainKey),
            );
            if (groupItems.length === 0) return null;

            const isExpanded = expandedGroups[group.id] !== false;

            return (
              <div key={group.id} className="space-y-1">
                {!isCollapsed ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "" : "-rotate-90"}`}
                    />
                  </button>
                ) : null}

                {(isCollapsed || isExpanded) &&
                  groupItems.map((item) => {
                    const effectiveHref =
                      item.mainKey === "member_rewards"
                        ? memberRewardsHref(session)
                        : item.href.split("?")[0] ?? item.href;
                    const isActive = isItemActive(effectiveHref, item.mainKey);
                    const Icon = item.icon;

                    return (
                      <button
                        key={item.href}
                        type="button"
                        title={item.label}
                        onClick={() => {
                          if (!confirmAdminProductUnsavedIfNeeded()) return;
                          setActiveMenu(item.mainKey!);
                          router.push(
                            item.mainKey === "member_rewards" ? memberRewardsHref(session) : item.href,
                          );
                        }}
                        className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                          isActive
                            ? "bg-[var(--surface-muted)] font-semibold text-[var(--primary)]"
                            : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                        } ${isCollapsed ? "justify-center" : "justify-between"}`}
                      >
                        <span className="flex items-center gap-3">
                          <Icon
                            size={18}
                            strokeWidth={1.5}
                            className={isActive ? "text-[var(--primary)]" : "text-[var(--text-muted)]"}
                            aria-hidden="true"
                          />
                          {!isCollapsed && <span>{item.label}</span>}
                        </span>
                      </button>
                    );
                  })}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
