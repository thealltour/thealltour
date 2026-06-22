import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { normalizeProduct } from "@/lib/products";
import { getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import { getSiteSettings, parseHomeGolfTourProductIds } from "@/lib/siteSettings";
import { buildGolfProductsHref } from "@/lib/products/golfChannel";
import {
  getGolfDestinationLandingHrefByDestinationId,
  getPublishedGolfDestinationLandings,
} from "@/lib/golfLandingLinks";
import type { Product } from "@/types/product";

const MAX_HOME_GOLF_PRODUCTS = 20;

async function getHomeGolfTourProductsUncached(): Promise<Product[]> {
  try {
    const settings = await getSiteSettings();
    const orderedIds = parseHomeGolfTourProductIds(settings);
    if (orderedIds.length === 0) return [];

    const { data: productRows, error } = await supabase
      .from("products")
      .select("*")
      .in("id", orderedIds)
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

    return orderedIds
      .map((id) => productMap.get(id))
      .filter((p): p is Product => p != null)
      .slice(0, MAX_HOME_GOLF_PRODUCTS);
  } catch {
    return [];
  }
}

export async function getHomeGolfTourProducts(): Promise<Product[]> {
  return unstable_cache(getHomeGolfTourProductsUncached, ["home-golf-tour-products"], {
    revalidate: 300,
    tags: ["site-settings"],
  })();
}

/** 홈 골프 섹션 더보기 — published 지역 골프 랜딩 우선, 없으면 채널 URL */
export async function resolveHomeGolfTourMoreHref(products: Product[]): Promise<string> {
  for (const product of products) {
    const href = await getGolfDestinationLandingHrefByDestinationId(product.destination_id);
    if (href) return href;
  }

  const landings = await getPublishedGolfDestinationLandings();
  if (landings.length > 0) return landings[0].href;

  return buildGolfProductsHref();
}
