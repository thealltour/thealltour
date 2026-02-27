import type { ReactNode } from "react";
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
            <AdminLayout>{children}</AdminLayout>
          </AdminConfirmProvider>
        </AdminToastProvider>
      </AdminRoleProvider>
    </AdminQueryProvider>
  );
}
