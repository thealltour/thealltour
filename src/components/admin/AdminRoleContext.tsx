"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import type { AdminSessionPermissions } from "@/lib/adminPermissions";
import type { AdminRole } from "@/types/adminRole";
import { hasAdminPermission } from "@/lib/adminPermissions";
import type { AdminPermissionKey } from "@/lib/adminPermissions";

export type AdminSessionContextValue = AdminSessionPermissions;

const defaultSession: AdminSessionContextValue = {
  role: "admin",
  permissions: ["*"],
  isBootstrapAdmin: true,
};

const AdminSessionContext = createContext<AdminSessionContextValue>(defaultSession);

export function useAdminSession() {
  return useContext(AdminSessionContext);
}

/** @deprecated useAdminSession 사용 */
export function useAdminRole() {
  const session = useAdminSession();
  return { role: session.role };
}

export function useAdminPermission(key: AdminPermissionKey) {
  const session = useAdminSession();
  return hasAdminPermission(session, key);
}

type AdminSessionProviderProps = {
  session?: AdminSessionContextValue;
  /** legacy: role만 전달 시 bootstrap admin으로 간주 */
  role?: AdminRole;
  children: ReactNode;
};

export function AdminRoleProvider({ session, role = "admin", children }: AdminSessionProviderProps) {
  const value: AdminSessionContextValue =
    session ??
    (role === "admin"
      ? defaultSession
      : { role, permissions: [], isBootstrapAdmin: false });

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>;
}

export { AdminRoleProvider as AdminSessionProvider };
