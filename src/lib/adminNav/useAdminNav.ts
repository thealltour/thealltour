"use client";

import { useMemo } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  buildAdminBreadcrumbLabels,
  inferMainMenuKey,
  resolveActiveSubTab,
  type MainMenuKey,
} from "@/lib/adminNav/adminNav.config";
import { ADMIN_PRODUCTS_QUERY_KEYS } from "@/components/admin/products/adminProducts.constants";

export function useAdminNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
  const status = searchParams.get("status");
  const tab = searchParams.get("tab");

  const activeMainKey = useMemo(() => inferMainMenuKey(pathname, view), [pathname, view]);
  const activeSubTab = useMemo(
    () =>
      resolveActiveSubTab(activeMainKey, pathname, {
        view,
        status,
        tab,
      }),
    [activeMainKey, pathname, view, status, tab],
  );
  const breadcrumbLabels = useMemo(
    () => buildAdminBreadcrumbLabels(pathname, view),
    [pathname, view],
  );

  return {
    activeMainKey,
    activeSubTab,
    breadcrumbLabels,
  };
}

export type { MainMenuKey };
