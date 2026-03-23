import type { ReactNode } from "react";
import { AdminRouteProviders } from "@/components/admin/AdminRouteProviders";
import type { AdminRole } from "@/types/adminRole";

export default function AdminAppLayout({ children }: { children: ReactNode }) {
  const role: AdminRole = "admin";
  return <AdminRouteProviders role={role}>{children}</AdminRouteProviders>;
}
