import type { ProductCardSource } from "@/lib/products/productListItem";

export function resolveRailProducts(
  source: "home_default" | "custom",
  productIds: string[],
  productsById: Map<string, ProductCardSource>,
  homeProducts: ProductCardSource[] = [],
): ProductCardSource[] {
  if (source === "home_default") {
    return homeProducts;
  }
  return productIds
    .map((id) => productsById.get(id))
    .filter((p): p is ProductCardSource => p != null);
}
