"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import { AdminResponsiveFrame } from "@/components/admin/AdminResponsiveFrame";
import AdminQueryProvider from "@/components/admin/AdminQueryProvider";
import { AdminRoleProvider } from "@/components/admin/AdminRoleContext";
import AdminToastProvider from "@/components/admin/AdminToastProvider";
import AdminConfirmProvider from "@/components/admin/AdminConfirmProvider";
import type { AdminRole } from "@/types/adminRole";

export type AdminRouteProvidersProps = {
  children: ReactNode;
  /** 추후 세션 기반 역할로 교체 */
  role?: AdminRole;
};

/**
 * /admin·/theall_manager_only 공통: Query/Role/Toast/Confirm + AdminResponsiveFrame.
 * 뷰포트에 따라 AdminLayout(데스크톱) 또는 MobileAdminShell(모바일)을 선택합니다.
 */
export function AdminRouteProviders({ children, role = "admin" }: AdminRouteProvidersProps) {
  return (
    <AdminQueryProvider>
      <AdminRoleProvider role={role}>
        <AdminToastProvider>
          <AdminConfirmProvider>
            <Suspense
              fallback={
                <div className="min-h-screen bg-[var(--bg)] text-[var(--text-primary)]">
                  <div className="mx-auto flex min-h-screen max-w-[1280px] flex-col gap-4 px-6 py-10 md:px-10">
                    <div className="h-10 w-48 animate-pulse rounded-lg bg-[var(--surface-muted)]" />
                    <div className="h-24 w-full max-w-2xl animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
                    <div className="grid flex-1 gap-4 md:grid-cols-[240px_1fr]">
                      <div className="hidden h-full min-h-[320px] animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] md:block" />
                      <div className="min-h-[320px] flex-1 animate-pulse rounded-xl border border-[var(--border)] bg-[var(--surface-muted)]" />
                    </div>
                    <p className="text-center text-xs text-[var(--text-muted)]">관리자 콘솔을 불러오는 중입니다…</p>
                  </div>
                </div>
              }
            >
              <AdminResponsiveFrame>{children}</AdminResponsiveFrame>
            </Suspense>
          </AdminConfirmProvider>
        </AdminToastProvider>
      </AdminRoleProvider>
    </AdminQueryProvider>
  );
}
