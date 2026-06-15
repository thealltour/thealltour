"use client";

/**
 * 데스크톱 관리자 전용 레이아웃 (고정 Sidebar + SubHeader + ml-64).
 * 모바일 MVP는 AdminResponsiveFrame → MobileAdminShell 경로에서 이 컴포넌트를 사용하지 않습니다.
 */

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import {
  SidebarCollapseProvider,
  useSidebarCollapse,
} from "@/components/admin/SidebarCollapseContext";
import Breadcrumb from "@/components/admin/Breadcrumb";
import SubHeader, { type MainMenuKey } from "@/components/admin/SubHeader";
import { useAdminSession } from "@/components/admin/AdminRoleContext";
import { SIDEBAR_ITEMS } from "@/components/admin/sidebarConfig";
import {
  getAdminConsoleRelativePath,
  isAdminConsolePublicPath,
  isAdminReviewSectionRelativePath,
} from "@/lib/adminConsolePaths";
import { canAccessSidebarMainKey, isSessionAllowedForConsolePath } from "@/lib/adminRolePolicy";
import { hasAdminPermission } from "@/lib/adminPermissions";
import { ADMIN_PRODUCTS_VIEW, ADMIN_PRODUCTS_QUERY_KEYS } from "@/components/admin/products/adminProducts.constants";

type AdminLayoutProps = {
  children: ReactNode;
};

const HOME_PRODUCT_VIEWS = new Set<string>([
  ADMIN_PRODUCTS_VIEW.FEATURED,
  ADMIN_PRODUCTS_VIEW.HOME_GOLF_TOUR_CARDS,
  ADMIN_PRODUCTS_VIEW.HOME_REGION_CARDS,
  ADMIN_PRODUCTS_VIEW.HOME_THEME_CARDS,
]);

function inferMainMenuKey(pathname: string, searchParamsView: string | null): MainMenuKey | null {
  const rel = getAdminConsoleRelativePath(pathname);
  if (rel == null) return null;
  if (rel === "/" || rel === "") return "dashboard";
  if (rel.startsWith("/banners")) return "home";
  if (rel.startsWith("/products")) {
    if (rel.includes("/new-modetour")) return "product";
    if (searchParamsView && HOME_PRODUCT_VIEWS.has(searchParamsView)) return "home";
    return "product";
  }
  if (rel.startsWith("/landings") || rel.startsWith("/golf-leads")) return "landings";
  if (rel.startsWith("/sms") || rel.startsWith("/inbound-sms")) return "sms";
  if (rel.startsWith("/inquiries")) return "inquiry";
  if (rel.startsWith("/members") || rel.startsWith("/points") || rel.startsWith("/rewards")) {
    return "member_rewards";
  }
  if (rel.startsWith("/settings")) return "settings";
  if (isAdminReviewSectionRelativePath(rel)) return "reviews";
  if (rel.startsWith("/guides")) return "guides";
  if (rel.startsWith("/notices")) return "notices";
  if (rel.startsWith("/notifications")) return "notifications";
  return null;
}

function canAccessPath(
  pathname: string,
  session: ReturnType<typeof useAdminSession>,
): boolean {
  if (isAdminConsolePublicPath(pathname)) return true;

  const pathStem = getAdminConsoleRelativePath(pathname);
  if (pathStem == null) return false;

  if (!isSessionAllowedForConsolePath(session, pathStem)) return false;

  if (pathStem.startsWith("/members") && !hasAdminPermission(session, "members.manage")) {
    return false;
  }

  for (const item of SIDEBAR_ITEMS) {
    if (!item.mainKey || !canAccessSidebarMainKey(session, item.mainKey)) continue;
    if (item.mainKey === "reviews") {
      if (isAdminReviewSectionRelativePath(pathStem)) return true;
      continue;
    }
    if (item.mainKey === "member_rewards") {
      if (
        pathStem.startsWith("/members") ||
        pathStem.startsWith("/points") ||
        pathStem.startsWith("/rewards")
      ) {
        if (pathStem.startsWith("/members") && !hasAdminPermission(session, "members.manage")) {
          continue;
        }
        if (pathStem.startsWith("/points") && !hasAdminPermission(session, "points.manage")) {
          continue;
        }
        if (pathStem.startsWith("/rewards") && !hasAdminPermission(session, "rewards.manage")) {
          continue;
        }
        return true;
      }
      continue;
    }
    if (item.mainKey === "home") {
      if (pathStem.startsWith("/banners")) return true;
      if (pathStem.startsWith("/products")) return true;
      continue;
    }
    if (item.mainKey === "landings") {
      if (pathStem.startsWith("/landings") || pathStem.startsWith("/golf-leads")) return true;
      continue;
    }
    const itemStem = getAdminConsoleRelativePath(item.href.split("?")[0] ?? item.href);
    if (itemStem == null) continue;
    if (pathStem === itemStem || pathStem.startsWith(`${itemStem}/`)) return true;
  }
  return false;
}

function AdminLayoutContent({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const viewParam = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
  const [activeMenu, setActiveMenu] = useState<MainMenuKey | null>(() =>
    inferMainMenuKey(pathname, viewParam),
  );
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);
  const session = useAdminSession();
  const [isNavigating, setIsNavigating] = useState(false);
  const { sidebarWidthPx } = useSidebarCollapse();

  useEffect(() => {
    setActiveMenu(inferMainMenuKey(pathname, viewParam));
    setActiveSubTab(null);
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 400);
    return () => clearTimeout(timer);
  }, [pathname, viewParam]);

  function AnimatedSection({ children }: { children: ReactNode }) {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }, []);

    return (
      <div
        className={`mt-4 transform transition-all duration-[180ms] ease-in-out ${
          visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-1"
        }`}
      >
        {children}
      </div>
    );
  }

  const canAccessCurrentPath = canAccessPath(pathname, session);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] transition-colors">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
      <main
        className="transition-all duration-300"
        style={{ marginLeft: `${sidebarWidthPx}px` }}
      >
        {isNavigating ? (
          <div
            className="fixed right-0 top-0 z-40 h-0.5 overflow-hidden bg-transparent transition-all duration-300"
            style={{ left: `${sidebarWidthPx}px` }}
          >
            <div className="h-full w-full origin-left animate-[adminProgress_0.4s_ease-out_forwards] bg-[var(--brand)]" />
          </div>
        ) : null}
        <div className="w-full px-6 pt-4 md:px-10">
          <div className="mx-auto max-w-[1280px]">
            <Breadcrumb />
          </div>
        </div>
        <SubHeader activeMenu={activeMenu} onTabChange={setActiveSubTab} />

        <div className="w-full px-6 py-10 md:px-10">
          <div className="max-w-full">
            <AnimatedSection
              key={`${activeMenu ?? "none"}-${activeSubTab ?? "none"}`}
            >
              {canAccessCurrentPath ? (
                children
              ) : (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6 text-sm text-[var(--text-primary)] shadow-[var(--shadow)] transition-colors">
                  <p className="font-semibold">
                    You do not have permission to access this page.
                  </p>
                  <p className="mt-1 text-xs text-[var(--text-muted)]">
                    Please contact an administrator if you believe this is a mistake.
                  </p>
                </div>
              )}
            </AnimatedSection>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  return (
    <SidebarCollapseProvider>
      <AdminLayoutContent>{children}</AdminLayoutContent>
    </SidebarCollapseProvider>
  );
}
