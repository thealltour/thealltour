"use client";

import type { ReactNode } from "react";
import AdminLogoutButton from "@/components/admin/AdminLogoutButton";
import { MobileAdminBottomNav } from "@/components/admin/mobile/MobileAdminBottomNav";

type MobileAdminShellProps = {
  title: string;
  children: ReactNode;
};

const MAIN_BOTTOM_PAD = "calc(5.5rem + env(safe-area-inset-bottom, 0px))";

/**
 * 모바일 관리자 전용 골격. Sidebar/SubHeader 미사용.
 * 후속 /m-admin 분리 시 이 컴포넌트를 새 레이아웃 루트로 옮기기 쉽게 유지.
 */
export function MobileAdminShell({ title, children }: MobileAdminShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--bg)] text-[var(--text-primary)]">
      <header
        className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--card)] px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top,0px))] shadow-sm"
      >
        <h1 className="truncate text-base font-semibold text-[var(--text-primary)]">{title}</h1>
        <AdminLogoutButton />
      </header>

      <main
        className="flex-1 overflow-y-auto px-4 py-3"
        style={{ paddingBottom: MAIN_BOTTOM_PAD }}
      >
        {children}
      </main>

      <MobileAdminBottomNav />
    </div>
  );
}
