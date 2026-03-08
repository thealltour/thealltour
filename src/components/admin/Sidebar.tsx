"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { MainMenuKey } from "@/components/admin/SubHeader";
import { useAdminRole } from "@/components/admin/AdminRoleContext";
import { SIDEBAR_ITEMS } from "@/components/admin/sidebarConfig";

type SidebarProps = {
  activeMenu: MainMenuKey | null;
  setActiveMenu: (key: MainMenuKey) => void;
};

export default function Sidebar({ activeMenu, setActiveMenu }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { role } = useAdminRole();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-300`}
      style={{ width: isCollapsed ? "72px" : "256px" }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between px-4 pt-6 pb-4">
          <Link href="/" className="inline-flex items-center">
            <Image
              src="/thealltour-logo.png"
              alt="THEALL TOUR logo"
              width={140}
              height={90}
              className="h-auto w-[120px]"
              sizes="120px"
            />
          </Link>
          <button
            type="button"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="ml-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface)] text-xs font-semibold text-[var(--text-muted)] shadow-sm transition-colors duration-150 hover:bg-[var(--surface-muted)]"
          >
            {isCollapsed ? ">>" : "<<"}
          </button>
        </div>
        {!isCollapsed && (
          <p className="px-4 pb-4 text-xs font-semibold tracking-[0.18em] text-[var(--brand)]">
            THEALL TOUR ADMIN
          </p>
        )}

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 pb-4">
          {SIDEBAR_ITEMS.filter((item) => item.section === "main" && item.roles.includes(role)).map(
            (item) => {
              const isActive = activeMenu === item.mainKey;
              const Icon = item.icon;
              return (
                <button
                  key={item.href}
                  type="button"
                  title={item.label}
                  onClick={() => {
                    if (item.mainKey) setActiveMenu(item.mainKey);
                    router.push(item.href);
                  }}
                  className={`flex w-full items-center rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? "bg-[var(--surface-muted)] text-[var(--primary)] font-semibold"
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
            },
          )}

          <div className="mt-4 space-y-1 border-t border-[var(--divider)] pt-3 text-xs text-[var(--text-muted)]">
            {!isCollapsed && (
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.16em]">기타</p>
            )}
            {SIDEBAR_ITEMS.filter(
              (item) => item.section === "extra" && item.roles.includes(role),
            ).map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/theall_manager_only"
                  ? pathname === "/theall_manager_only"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`flex items-center rounded-lg px-3 py-2 text-xs font-medium transition-colors duration-150 ${
                    isActive
                      ? "bg-[var(--surface-muted)] text-[var(--primary)] font-semibold"
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
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </aside>
  );
}
