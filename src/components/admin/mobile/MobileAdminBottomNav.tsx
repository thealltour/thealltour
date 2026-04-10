"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, MessageSquare, Star } from "lucide-react";
import { MOBILE_ADMIN_PRIMARY_NAV } from "@/components/admin/mobile/mobileAdmin.constants";

const ICONS = {
  home: Home,
  inquiry: MessageSquare,
  bell: Bell,
  star: Star,
} as const;

function isNavItemActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  if (href === "/admin/reviews" && pathname.startsWith("/admin/reviews")) return true;
  if (href === "/theall_manager_only" && (pathname === "/theall_manager_only" || pathname === "/admin")) {
    return true;
  }
  if (href !== "/theall_manager_only" && pathname.startsWith(`${href}/`)) return true;
  return false;
}

/**
 * 모바일 관리자 하단 탭. 데스크톱 사이드바와 별도 상수(MOBILE_ADMIN_PRIMARY_NAV) 기반.
 */
export function MobileAdminBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-[var(--border)] bg-[var(--surface)] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
      aria-label="모바일 관리자 주요 메뉴"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-around px-1">
        {MOBILE_ADMIN_PRIMARY_NAV.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isNavItemActive(pathname, item.href);

          return (
            <li key={item.key} className="flex-1">
              <Link
                href={item.href}
                className={`flex min-h-[3rem] flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1 text-[11px] font-medium transition-colors ${
                  active
                    ? "text-[var(--primary)]"
                    : "text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} aria-hidden />
                <span className="leading-tight">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
