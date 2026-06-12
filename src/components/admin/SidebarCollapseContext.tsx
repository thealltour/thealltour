"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export const SIDEBAR_WIDTH_EXPANDED_PX = 256;
export const SIDEBAR_WIDTH_COLLAPSED_PX = 72;

type SidebarCollapseContextValue = {
  isCollapsed: boolean;
  setIsCollapsed: (value: boolean | ((prev: boolean) => boolean)) => void;
  sidebarWidthPx: number;
};

const SidebarCollapseContext = createContext<SidebarCollapseContextValue | null>(null);

export function SidebarCollapseProvider({ children }: { children: ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const value = useMemo(
    () => ({
      isCollapsed,
      setIsCollapsed,
      sidebarWidthPx: isCollapsed ? SIDEBAR_WIDTH_COLLAPSED_PX : SIDEBAR_WIDTH_EXPANDED_PX,
    }),
    [isCollapsed],
  );

  return <SidebarCollapseContext.Provider value={value}>{children}</SidebarCollapseContext.Provider>;
}

export function useSidebarCollapse() {
  const ctx = useContext(SidebarCollapseContext);
  if (!ctx) {
    throw new Error("useSidebarCollapse must be used within SidebarCollapseProvider");
  }
  return ctx;
}
