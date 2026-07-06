import "server-only";

import { collectGolfProductRailNodes, type MobileGolfAdBodyDoc } from "@/lib/adminMobileGolfAds/bodyDoc";
import { getHomeGolfTourProducts } from "@/lib/homeGolfTourProducts";
import { normalizeProduct } from "@/lib/products";
import { getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Product } from "@/types/product";

const MAX_PRODUCTS = 20;

async function fetchProductsByIds(orderedIds: string[]): Promise<Product[]> {
  const uniqueIds = [...new Set(orderedIds.map((id) => id.trim()).filter(Boolean))].slice(
    0,
    MAX_PRODUCTS,
  );
  if (uniqueIds.length === 0) return [];

  const { data: productRows, error } = await supabaseAdmin
    .from("products")
    .select("*")
    .in("id", uniqueIds)
    .eq("is_active", true);

  if (error || !productRows?.length) return [];

  const productMap = new Map<string, Product>();
  for (const row of productRows) {
    const p = normalizeProduct(row as Record<string, unknown>);
    productMap.set(p.id, p);
  }

  const campaignTax = await getCampaignTaxonomiesForCard();
  const hydrated = hydrateProductsWithCampaignCardMeta([...productMap.values()], campaignTax);
  for (const p of hydrated) {
    productMap.set(p.id, p);
  }

  return uniqueIds
    .map((id) => productMap.get(id))
    .filter((p): p is Product => p != null);
}

export async function resolveProductsForGolfProductRail(
  source: "home_default" | "custom",
  productIds: string[],
): Promise<Product[]> {
  if (source === "home_default") {
    return getHomeGolfTourProducts();
  }
  return fetchProductsByIds(productIds);
}

export async function resolveAllMobileGolfAdProducts(
  bodyDoc: MobileGolfAdBodyDoc,
): Promise<Map<string, Product>> {
  const rails = collectGolfProductRailNodes(bodyDoc);
  const map = new Map<string, Product>();

  for (const rail of rails) {
    const products = await resolveProductsForGolfProductRail(
      rail.attrs.source,
      rail.attrs.productIds,
    );
    for (const product of products) {
      map.set(product.id, product);
    }
  }

  return map;
}
