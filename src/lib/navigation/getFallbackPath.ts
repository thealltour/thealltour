import { getProductsFunnelPathKind } from "@/lib/routing/getProductsFunnelPathKind";

/**
 * 모바일 뒤로가기 시 history가 없을 때 사용할 안전 fallback.
 * 허브(`/products/region`, `/products/theme`)는 상위로 한 단계씩 올라갑니다.
 */
export function getFallbackPath(pathname: string): string {
  const p = pathname.split("?")[0] ?? pathname;
  const k = getProductsFunnelPathKind(p);
  switch (k) {
    case "products_region_landing":
      return "/products/region";
    case "products_region_hub":
      return "/products";
    case "products_theme_landing":
      return "/products/theme";
    case "products_theme_hub":
      return "/products";
    case "products_product_detail":
    case "products_other":
      return "/products";
    case "products_root":
      return "/";
    case "outside":
    default:
      return "/";
  }
}
