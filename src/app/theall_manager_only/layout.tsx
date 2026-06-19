import type { ReactNode } from "react";
import { AdminRouteProviders } from "@/components/admin/AdminRouteProviders";
import { ADMIN_PWA_METADATA, ADMIN_PWA_VIEWPORT } from "@/lib/adminPwaMetadata";
import { getAdminSession } from "@/lib/adminServerSession";

export const metadata = ADMIN_PWA_METADATA;
export const viewport = ADMIN_PWA_VIEWPORT;

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
