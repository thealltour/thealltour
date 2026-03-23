/**
 * 상품 탐색 퍼널(/products 계열) 전용 네비게이션 노출 정책.
 * 홈·결제·로그인 등과 분리해 추후 page group 확장 시 이 모듈만 확장하면 됩니다.
 */

import { getFallbackPath } from "@/lib/navigation/getFallbackPath";

const PRODUCTS_ROOT = "/products";

/** 지역/테마 허브 경로 (브레드크럼·fallback 공통) */
export const PRODUCTS_REGION_HUB = `${PRODUCTS_ROOT}/region`;
export const PRODUCTS_THEME_HUB = `${PRODUCTS_ROOT}/theme`;

/**
 * NavigationContextHeader(MobileBack + Desktop Breadcrumb)를 붙일지 여부.
 */
export function showProductsNavigationContext(pathname: string): boolean {
  if (pathname === PRODUCTS_ROOT) return true;
  if (pathname === PRODUCTS_REGION_HUB || pathname === PRODUCTS_THEME_HUB) return true;
  if (!pathname.startsWith(`${PRODUCTS_ROOT}/`)) return false;
  const rest = pathname.slice(PRODUCTS_ROOT.length + 1);
  if (!rest || rest.includes("//")) return false;
  if (rest.startsWith("region/")) {
    const slug = rest.slice("region/".length);
    return slug.length > 0 && !slug.includes("/");
  }
  if (rest.startsWith("theme/")) {
    const slug = rest.slice("theme/".length);
    return slug.length > 0 && !slug.includes("/");
  }
  if (!rest.includes("/")) {
    return rest.length > 0;
  }
  return false;
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
  if (pathname === PRODUCTS_ROOT) return "products_index";
  if (pathname === PRODUCTS_REGION_HUB) return "products_region_hub";
  if (pathname === PRODUCTS_THEME_HUB) return "products_theme_hub";
  if (!pathname.startsWith(`${PRODUCTS_ROOT}/`)) return "unknown";
  const rest = pathname.slice(PRODUCTS_ROOT.length + 1);
  if (rest.startsWith("region/") && !rest.slice("region/".length).includes("/")) {
    return "products_region";
  }
  if (rest.startsWith("theme/") && !rest.slice("theme/".length).includes("/")) {
    return "products_theme";
  }
  if (!rest.includes("/") && rest !== "region" && rest !== "theme") {
    return "product_detail";
  }
  return "unknown";
}

/**
 * 직접 URL 진입 등 history가 없을 때 router.push 할 경로.
 */
export function getProductsBackFallbackFromPathname(pathname: string): string {
  return getFallbackPath(pathname);
}
