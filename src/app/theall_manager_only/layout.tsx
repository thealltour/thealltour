import type { ReactNode } from "react";
import { AdminRouteProviders } from "@/components/admin/AdminRouteProviders";
import type { AdminRole } from "@/types/adminRole";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  // TODO: Replace with real auth-based role resolution.
  const role: AdminRole = "admin";
  return <AdminRouteProviders role={role}>{children}</AdminRouteProviders>;
}
