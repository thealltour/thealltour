"use client";

import type { ReactNode } from "react";
import { createContext, useContext } from "react";
import type { AdminRole } from "@/types/adminRole";

type AdminRoleContextValue = {
  role: AdminRole;
};

const AdminRoleContext = createContext<AdminRoleContextValue>({ role: "admin" });

export function useAdminRole() {
  return useContext(AdminRoleContext);
}

type AdminRoleProviderProps = {
  role?: AdminRole;
  children: ReactNode;
};

export function AdminRoleProvider({ role = "admin", children }: AdminRoleProviderProps) {
  return <AdminRoleContext.Provider value={{ role }}>{children}</AdminRoleContext.Provider>;
}

