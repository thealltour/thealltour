"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ProductFilterSidebar } from "@/components/products/ProductFilterSidebar";
import { buildProductsSearchParams, type ProductFiltersState } from "@/lib/productFilters";
import type { RegionTreeNode } from "@/types/productTaxonomy";

export type HubFilterSidebarProps = {
  regionOptions: string[];
  regionTree?: RegionTreeNode[];
  themeOptions: string[];
  themeTree?: RegionTreeNode[];
  productLineOptions: string[];
  /** 랜딩 페이지에서 현재 지역/테마에 맞춰 초기 선택 (선택 사항) */
  initialFilters?: Partial<ProductFiltersState> | null;
  className?: string;
};

const emptyFilters: ProductFiltersState = {
  region: null,
  theme: null,
  product_line: null,
  sort: "",
  q: null,
  collection: null,
};

/**
 * 허브/랜딩 페이지용 필터 사이드바.
 * 선택 시 /products 로 이동하며 해당 필터 쿼리 적용.
 */
export function HubFilterSidebar({
  regionOptions,
  regionTree,
  themeOptions,
  themeTree,
  productLineOptions,
  initialFilters = null,
  className,
}: HubFilterSidebarProps) {
  const router = useRouter();
  const [filters, setFilters] = useState<ProductFiltersState>(() => ({
    ...emptyFilters,
    ...(initialFilters ?? {}),
  }));

  const handleFilterChange = useMemo(
    () => (next: Partial<ProductFiltersState>) => {
      const merged: ProductFiltersState = {
        ...emptyFilters,
        ...filters,
        ...next,
      };
      setFilters(merged);
      const qs = buildProductsSearchParams(merged);
      router.push(qs ? `/products?${qs}` : "/products");
    },
    [filters, router],
  );

  return (
    <ProductFilterSidebar
      regionOptions={regionOptions}
      regionTree={regionTree}
      themeOptions={themeOptions}
      themeTree={themeTree}
      productLineOptions={productLineOptions}
      filters={filters}
      onFilterChange={handleFilterChange}
      className={className}
    />
  );
}
