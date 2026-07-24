"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ADMIN_PRODUCTS_QUERY_KEYS } from "@/components/admin/products/adminProducts.constants";
import { buildAdminBreadcrumbLabels } from "@/lib/adminNav/adminNav.config";

export default function Breadcrumb() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const view = searchParams.get(ADMIN_PRODUCTS_QUERY_KEYS.VIEW);
  const tab = searchParams.get("tab");
  const labels = buildAdminBreadcrumbLabels(pathname, view, tab);

  if (labels.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className="text-xs text-gray-500">
      {labels.map((label, index) => {
        const isLast = index === labels.length - 1;
        return (
          <span key={`${label}-${index}`} className={isLast ? "font-semibold" : undefined}>
            {index > 0 && <span className="px-1 text-gray-400">/</span>}
            {label}
          </span>
        );
      })}
    </nav>
  );
}
