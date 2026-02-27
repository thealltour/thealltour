"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import Breadcrumb from "@/components/admin/Breadcrumb";
import SubHeader, { type MainMenuKey } from "@/components/admin/SubHeader";
import { useAdminRole } from "@/components/admin/AdminRoleContext";
import { SIDEBAR_ITEMS } from "@/components/admin/sidebarConfig";

type AdminLayoutProps = {
  children: ReactNode;
};

function inferMainMenuKey(pathname: string): MainMenuKey | null {
  if (pathname === "/theall_manager_only") return "dashboard";
  if (pathname.startsWith("/theall_manager_only/products")) return "product";
  if (pathname.startsWith("/theall_manager_only/inquiries")) return "inquiry";
  if (pathname.startsWith("/theall_manager_only/members")) return "member";
   if (pathname.startsWith("/theall_manager_only/settings")) return "settings";
   if (pathname.startsWith("/theall_manager_only/reviews")) return "reviews";
   if (pathname.startsWith("/theall_manager_only/guides")) return "guides";
   if (pathname.startsWith("/theall_manager_only/banners")) return "banners";
   if (pathname.startsWith("/theall_manager_only/notices")) return "notices";
   if (pathname.startsWith("/theall_manager_only/notifications")) return "notifications";
  return null;
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

  const canAccessCurrentPath = SIDEBAR_ITEMS.some(
    (item) => item.roles.includes(role) && pathname.startsWith(item.href),
  );

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

