import type { BreadcrumbItem } from "@/components/navigation/Breadcrumb";
import {
  PRODUCTS_REGION_HUB,
  PRODUCTS_THEME_HUB,
} from "@/lib/navigation/productsNavigationPolicy";

/**
 * 상품 탐색 퍼널 page type — 라벨/트레일 생성 시 단일 진입점.
 */
export type ProductsNavKind = "index" | "product_detail" | "region" | "theme";

const LABELS = {
  home: "홈",
  catalog: "여행상품",
  regionHub: "지역별 상품",
  themeHub: "테마별 상품",
} as const;

export type BuildProductsBreadcrumbParams = {
  /** 화면에 표시할 현재 구간 제목 (상품명·택소노미 표시명 등) */
  currentLabel: string;
};

/**
 * products 계열 페이지용 브레드크럼 아이템 (마지막은 현재 페이지, href 없음).
 * 표시명은 서버에서 `getTaxonomyNameBySlug` 등과 맞춘 `currentLabel`을 넘깁니다.
 */
export function buildProductsBreadcrumbItems(
  kind: ProductsNavKind,
  params: BuildProductsBreadcrumbParams,
): BreadcrumbItem[] {
  const root: BreadcrumbItem = { label: LABELS.home, href: "/" };
  const catalog: BreadcrumbItem = { label: LABELS.catalog, href: "/products" };

  switch (kind) {
    case "index":
      return [root, { label: LABELS.catalog }];
    case "product_detail":
      return [root, catalog, { label: params.currentLabel }];
    case "region":
      return [
        root,
        catalog,
        { label: LABELS.regionHub, href: PRODUCTS_REGION_HUB },
        { label: params.currentLabel },
      ];
    case "theme":
      return [
        root,
        catalog,
        { label: LABELS.themeHub, href: PRODUCTS_THEME_HUB },
        { label: params.currentLabel },
      ];
  }
}

export function getProductsNavFallbackHref(kind: ProductsNavKind): string {
  switch (kind) {
    case "index":
      return "/";
    case "product_detail":
      return "/products";
    case "region":
      return PRODUCTS_REGION_HUB;
    case "theme":
      return PRODUCTS_THEME_HUB;
  }
}
