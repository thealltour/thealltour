export const PRODUCTS_ROOT = "/products";
export const PRODUCTS_REGION_HUB = `${PRODUCTS_ROOT}/region`;
export const PRODUCTS_THEME_HUB = `${PRODUCTS_ROOT}/theme`;

/**
 * `/products` 퍼널 pathname 단일 분류 — 내비·fallback·경로 종류 판별의 공통 소스.
 */
export type ProductsFunnelPathKind =
  | "outside"
  | "products_root"
  | "products_region_hub"
  | "products_theme_hub"
  | "products_region_landing"
  | "products_theme_landing"
  | "products_product_detail"
  /** `/products/...` 이지만 위 범주에 해당하지 않음 (예: 중첩 세그먼트) */
  | "products_other";

export function getProductsFunnelPathKind(pathname: string): ProductsFunnelPathKind {
  const p = pathname.split("?")[0] ?? pathname;
  if (p === PRODUCTS_ROOT) return "products_root";
  if (p === PRODUCTS_REGION_HUB) return "products_region_hub";
  if (p === PRODUCTS_THEME_HUB) return "products_theme_hub";
  if (!p.startsWith(`${PRODUCTS_ROOT}/`)) return "outside";
  const rest = p.slice(PRODUCTS_ROOT.length + 1);
  if (!rest || rest.includes("//")) return "products_other";
  if (rest.startsWith("region/")) {
    const slug = rest.slice("region/".length);
    if (slug.length > 0 && !slug.includes("/")) return "products_region_landing";
    return "products_other";
  }
  if (rest.startsWith("theme/")) {
    const slug = rest.slice("theme/".length);
    if (slug.length > 0 && !slug.includes("/")) return "products_theme_landing";
    return "products_other";
  }
  if (!rest.includes("/") && rest.length > 0) {
    if (rest === "region" || rest === "theme") return "products_other";
    return "products_product_detail";
  }
  return "products_other";
}
