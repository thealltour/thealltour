import type { ReactNode } from "react";
import { AdminRouteProviders } from "@/components/admin/AdminRouteProviders";
import { getAdminSession } from "@/lib/adminServerSession";

export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const session = await getAdminSession();
  return (
    <AdminRouteProviders
      session={
        session ?? {
          role: "admin",
          permissions: [],
          isBootstrapAdmin: false,
        }
      }
    >
      {children}
    </AdminRouteProviders>
  );
}
