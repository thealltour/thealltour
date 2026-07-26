"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarDays,
  Home,
  LayoutGrid,
  MessageSquare,
  MessagesSquare,
  Star,
  Users,
} from "lucide-react";
import {
  ADMIN_PWA_HUB_HREF,
  getMobileAdminNavForSession,
  getTabletAdminHubMenus,
} from "@/components/admin/mobile/mobileAdmin.constants";
import { useAdminSession } from "@/components/admin/AdminRoleContext";
import { getAdminConsoleRelativePath } from "@/lib/adminConsolePaths";
import { useAdminNotificationsRealtime } from "@/hooks/useAdminNotificationsRealtime";

function isNavItemActive(pathname: string, href: string): boolean {
  const currentRel = getAdminConsoleRelativePath(pathname);
  const targetRel = getAdminConsoleRelativePath(href);
  if (currentRel != null && targetRel != null) {
    if (currentRel === targetRel) return true;
    if (targetRel !== "/" && currentRel.startsWith(`${targetRel}/`)) return true;
  }
  if (pathname === href) return true;
  if (href === "/theall_manager_only" && (pathname === "/theall_manager_only" || pathname === "/admin")) {
    return true;
  }
  if (href !== "/theall_manager_only" && pathname.startsWith(`${href}/`)) return true;
  return false;
}

const PRIMARY_ICONS = {
  home: Home,
  inquiry: MessageSquare,
  users: Users,
  bell: Bell,
  sms: MessagesSquare,
} as const;

function hubIcon(key: string) {
  switch (key) {
    case "bookings":
      return CalendarDays;
    case "reviews":
      return Star;
    case "hub":
      return LayoutGrid;
    case "team-chat":
      return MessagesSquare;
    case "inquiry-dashboard":
      return MessageSquare;
    default:
      return Home;
  }
}

/**
 * 태블릿 가로 모드 좌측 레일 — 하단 탭 + 허브 추가 메뉴.
 */
export function TabletAdminSideRail() {
  const pathname = usePathname();
  const session = useAdminSession();
  const primary = getMobileAdminNavForSession(session);
  const hubMenus = getTabletAdminHubMenus(session);
  const { unreadCount } = useAdminNotificationsRealtime();
  const extra = hubMenus.filter(
    (m) => !primary.some((p) => getAdminConsoleRelativePath(p.href) === getAdminConsoleRelativePath(m.href)),
  );

  return (
    <aside
      className="sticky top-0 z-40 flex h-dvh w-52 shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] pb-[env(safe-area-inset-bottom,0px)] pt-[env(safe-area-inset-top,0px)]"
      aria-label="태블릿 관리자 메뉴"
    >
      <div className="border-b border-[var(--border)] px-3 py-3">
        <p className="text-xs font-semibold text-[var(--text-muted)]">더올 관리</p>
        <Link
          href={ADMIN_PWA_HUB_HREF}
          className={`mt-2 flex items-center gap-2 rounded-lg px-2 py-2 text-sm font-medium ${
            isNavItemActive(pathname, ADMIN_PWA_HUB_HREF)
              ? "bg-[var(--surface-muted)] text-[var(--primary)]"
              : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
          }`}
        >
          <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
          앱 · 메뉴
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        <ul className="space-y-0.5">
          {primary.map((item) => {
            const Icon = PRIMARY_ICONS[item.icon];
            const active = isNavItemActive(pathname, item.href);
            const showBadge = item.key === "notifications" && unreadCount > 0;
            return (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-[var(--surface-muted)] text-[var(--primary)]"
                      : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                  }`}
                  aria-current={active ? "page" : undefined}
                  aria-label={
                    showBadge ? `${item.label}, 미읽음 ${unreadCount}건` : item.label
                  }
                >
                  <span className="relative inline-flex">
                    <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                    {showBadge ? (
                      <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--danger)] px-1 text-[9px] font-bold leading-none text-white">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
          {extra.length > 0 ? (
            <li className="pt-2">
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-subtle)]">
                더보기
              </p>
              <ul className="space-y-0.5">
                {extra.map((item) => {
                  const Icon = hubIcon(item.key);
                  const active = isNavItemActive(pathname, item.href);
                  return (
                    <li key={item.key}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-2 rounded-lg px-2 py-2.5 text-sm font-medium transition-colors ${
                          active
                            ? "bg-[var(--surface-muted)] text-[var(--primary)]"
                            : "text-[var(--text-secondary)] hover:bg-[var(--surface-muted)] hover:text-[var(--text-primary)]"
                        }`}
                        aria-current={active ? "page" : undefined}
                      >
                        <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} aria-hidden />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          ) : null}
        </ul>
      </nav>
    </aside>
  );
}
