/**
 * 상품 탐색 퍼널(/products 계열) 전용 네비게이션 노출 정책.
 * 홈·결제·로그인 등과 분리해 추후 page group 확장 시 이 모듈만 확장하면 됩니다.
 */

import { getFallbackPath } from "@/lib/navigation/getFallbackPath";
import {
  getProductsFunnelPathKind,
  PRODUCTS_REGION_HUB,
  PRODUCTS_THEME_HUB,
} from "@/lib/routing/getProductsFunnelPathKind";

export { PRODUCTS_REGION_HUB, PRODUCTS_THEME_HUB };

/**
 * NavigationContextHeader(MobileBack + Desktop Breadcrumb)를 붙일지 여부.
 */
export function showProductsNavigationContext(pathname: string): boolean {
  const k = getProductsFunnelPathKind(pathname);
  return (
    k === "products_root" ||
    k === "products_region_hub" ||
    k === "products_theme_hub" ||
    k === "products_region_landing" ||
    k === "products_theme_landing" ||
    k === "products_product_detail"
  );
}

export type ProductsNavPathKind =
  | "products_index"
  | "product_detail"
  | "products_region"
  | "products_theme"
  | "products_region_hub"
  | "products_theme_hub"
  | "unknown";

export function getProductsNavPathKind(pathname: string): ProductsNavPathKind {
  const k = getProductsFunnelPathKind(pathname);
  switch (k) {
    case "products_root":
      return "products_index";
    case "products_region_hub":
      return "products_region_hub";
    case "products_theme_hub":
      return "products_theme_hub";
    case "products_region_landing":
      return "products_region";
    case "products_theme_landing":
      return "products_theme";
    case "products_product_detail":
      return "product_detail";
    default:
      return "unknown";
  }
}

/**
 * 직접 URL 진입 등 history가 없을 때 router.push 할 경로.
 */
export function getProductsBackFallbackFromPathname(pathname: string): string {
  return getFallbackPath(pathname);
}
