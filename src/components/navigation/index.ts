export { Breadcrumb, type BreadcrumbItem, type BreadcrumbProps } from "./Breadcrumb";
export {
  buildProductsBreadcrumbItems,
  getProductsNavFallbackHref,
  type ProductsNavKind,
  type BuildProductsBreadcrumbParams,
} from "./breadcrumb-config";
export { MobileBackHeader, type MobileBackHeaderProps } from "./MobileBackHeader";
export {
  NavigationContextHeader,
  type NavigationContextHeaderProps,
} from "./NavigationContextHeader";
export { useBackNavigation } from "./useBackNavigation";
export { getFallbackPath } from "./getFallbackPath";

export {
  showProductsNavigationContext,
  getProductsBackFallbackFromPathname,
  getProductsNavPathKind,
  type ProductsNavPathKind,
  PRODUCTS_REGION_HUB,
  PRODUCTS_THEME_HUB,
} from "@/lib/navigation/productsNavigationPolicy";
