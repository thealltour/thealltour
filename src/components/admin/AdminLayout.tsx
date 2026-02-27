"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Sidebar from "@/components/admin/Sidebar";
import SubHeader, { type MainMenuKey } from "@/components/admin/SubHeader";

type AdminLayoutProps = {
  children: ReactNode;
};

function inferMainMenuKey(pathname: string): MainMenuKey | null {
  if (pathname === "/theall_manager_only") return "dashboard";
  if (pathname.startsWith("/theall_manager_only/products")) return "product";
  if (pathname.startsWith("/theall_manager_only/inquiries")) return "inquiry";
  if (pathname.startsWith("/theall_manager_only/members")) return "member";
  return null;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const pathname = usePathname();
  const [activeMenu, setActiveMenu] = useState<MainMenuKey | null>(() =>
    inferMainMenuKey(pathname),
  );
  const [activeSubTab, setActiveSubTab] = useState<string | null>(null);

  useEffect(() => {
    setActiveMenu(inferMainMenuKey(pathname));
    setActiveSubTab(null);
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

  return (
    <div className="min-h-screen bg-[#f8fbff]">
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
      <main className="ml-64 text-[#0f172a]">
        <SubHeader activeMenu={activeMenu} onTabChange={setActiveSubTab} />

        <div className="mx-auto w-full max-w-[1280px] px-10 py-10">
          <AnimatedSection key={`${activeMenu ?? "none"}-${activeSubTab ?? "none"}`}>
            {children}
          </AnimatedSection>
        </div>
      </main>
    </div>
  );
}

