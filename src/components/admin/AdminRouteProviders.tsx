"use client";

import type { ReactNode } from "react";
import { Suspense } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
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
 * /admin·/theall_manager_only 공통: Query/Role/Toast/Confirm + AdminLayout 래퍼.
 * 레이아웃 파일 중복을 막기 위해 한 컴포넌트로 묶습니다.
 */
export function AdminRouteProviders({ children, role = "admin" }: AdminRouteProvidersProps) {
  return (
    <AdminQueryProvider>
      <AdminRoleProvider role={role}>
        <AdminToastProvider>
          <AdminConfirmProvider>
            <Suspense
              fallback={
                <div className="flex min-h-screen items-center justify-center bg-[var(--bg)] text-[var(--text-muted)]">
                  <span className="text-xs">관리자 콘솔을 불러오는 중입니다...</span>
                </div>
              }
            >
              <AdminLayout>{children}</AdminLayout>
            </Suspense>
          </AdminConfirmProvider>
        </AdminToastProvider>
      </AdminRoleProvider>
    </AdminQueryProvider>
  );
}
