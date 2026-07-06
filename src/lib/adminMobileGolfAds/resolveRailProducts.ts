import type { Product } from "@/types/product";

export function resolveRailProducts(
  source: "home_default" | "custom",
  productIds: string[],
  productsById: Map<string, Product>,
  homeProducts: Product[] = [],
): Product[] {
  if (source === "home_default") {
    return homeProducts;
  }
  return productIds
    .map((id) => productsById.get(id))
    .filter((p): p is Product => p != null);
}
