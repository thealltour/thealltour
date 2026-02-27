import type { ReactNode } from "react";
import { Suspense } from "react";
import AdminLayout from "@/components/admin/AdminLayout";
import AdminQueryProvider from "@/components/admin/AdminQueryProvider";
import { AdminRoleProvider } from "@/components/admin/AdminRoleContext";
import AdminToastProvider from "@/components/admin/AdminToastProvider";
import AdminConfirmProvider from "@/components/admin/AdminConfirmProvider";
import type { AdminRole } from "@/types/adminRole";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  // TODO: Replace with real auth-based role resolution.
  const role: AdminRole = "admin";

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
