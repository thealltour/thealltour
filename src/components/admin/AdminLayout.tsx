"use client";

/**
 * 데스크톱 관리자 전용 레이아웃 (고정 Sidebar + SubHeader + ml-64).
 * 모바일 MVP는 AdminResponsiveFrame → MobileAdminShell 경로에서 이 컴포넌트를 사용하지 않습니다.
 */

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import Breadcrumb from "@/components/admin/Breadcrumb";
import SubHeader, { type MainMenuKey } from "@/components/admin/SubHeader";
import { useAdminRole } from "@/components/admin/AdminRoleContext";
import { SIDEBAR_ITEMS } from "@/components/admin/sidebarConfig";
import {
  getAdminConsoleRelativePath,
  isAdminConsolePublicPath,
  isAdminReviewSectionRelativePath,
} from "@/lib/adminConsolePaths";

type AdminLayoutProps = {
  children: ReactNode;
};

function inferMainMenuKey(pathname: string): MainMenuKey | null {
  const rel = getAdminConsoleRelativePath(pathname);
  if (rel == null) return null;
  if (rel === "/" || rel === "") return "dashboard";
  if (rel.startsWith("/products")) return "product";
  if (rel.startsWith("/landings")) return "landings";
  if (rel.startsWith("/inquiries/dashboard")) return "inquiry_dashboard";
  if (rel.startsWith("/inquiries")) return "inquiry";
  if (rel.startsWith("/members")) return "member";
  if (rel.startsWith("/rewards")) return "rewards";
  if (rel.startsWith("/points")) return "points";
  if (rel.startsWith("/settings")) return "settings";
  if (isAdminReviewSectionRelativePath(rel)) return "reviews";
  if (rel.startsWith("/guides")) return "guides";
  if (rel.startsWith("/banners")) return "banners";
  if (rel.startsWith("/notices")) return "notices";
  if (rel.startsWith("/notifications")) return "notifications";
  return null;
}

function canAccessPath(
  pathname: string,
  role: string,
  items: typeof SIDEBAR_ITEMS,
): boolean {
  if (isAdminConsolePublicPath(pathname)) return true;

  const roleOk = role as "admin" | "manager" | "viewer";
  const pathStem = getAdminConsoleRelativePath(pathname);
  if (pathStem == null) return false;

  for (const item of items) {
    if (!item.roles.includes(roleOk)) continue;
    if (item.mainKey === "reviews") {
      if (isAdminReviewSectionRelativePath(pathStem)) return true;
      continue;
    }
    const itemStem = getAdminConsoleRelativePath(item.href);
    if (itemStem == null) continue;
    if (pathStem === itemStem || pathStem.startsWith(`${itemStem}/`)) return true;
  }
  return false;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [activeMenu, setActiveMenu] = useState<MainMenuKey | null>(() =>
    inferMainMenuKey(pathname),
  );
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);
  const { role } = useAdminRole();
  const [isNavigating, setIsNavigating] = useState(false);

  useEffect(() => {
    setActiveMenu(inferMainMenuKey(pathname));
    setActiveSubTab(null);
    setIsNavigating(true);
    const timer = setTimeout(() => setIsNavigating(false), 400);
    return () => clearTimeout(timer);
  }, [pathname]);

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

  const canAccessCurrentPath = canAccessPath(pathname, role, SIDEBAR_ITEMS);

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)] transition-colors">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
      <main className="ml-64 transition-colors">
        {isNavigating ? (
          <div className="fixed left-64 right-0 top-0 z-40 h-0.5 overflow-hidden bg-transparent">
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

