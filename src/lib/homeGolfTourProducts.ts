import { unstable_cache } from "next/cache";
import { supabase } from "@/lib/supabase";
import { getCampaignTaxonomiesForCard } from "@/lib/productTaxonomies";
import { hydrateProductsWithCampaignCardMeta } from "@/lib/productCampaignResolve";
import {
  mapProductRowToListItem,
  PRODUCT_LISTING_SELECT,
  type ProductListItem,
} from "@/lib/products/productListItem";
import { getSiteSettings, parseHomeGolfTourProductIds } from "@/lib/siteSettings";
import { buildGolfProductsHref } from "@/lib/products/golfChannel";
import {
  getGolfDestinationLandingHrefByDestinationId,
  getPublishedGolfDestinationLandings,
} from "@/lib/golfLandingLinks";

const MAX_HOME_GOLF_PRODUCTS = 20;

async function getHomeGolfTourProductsUncached(): Promise<ProductListItem[]> {
  try {
    const settings = await getSiteSettings();
    const orderedIds = parseHomeGolfTourProductIds(settings);
    if (orderedIds.length === 0) return [];

    const { data: productRows, error } = await supabase
      .from("products")
      .select(PRODUCT_LISTING_SELECT)
      .in("id", orderedIds)
      .eq("is_active", true);

    if (error || !productRows?.length) return [];

    const listItems = (productRows as unknown as Record<string, unknown>[]).map((row) =>
      mapProductRowToListItem(row),
    );
    const campaignTax = await getCampaignTaxonomiesForCard();
    const hydrated = hydrateProductsWithCampaignCardMeta(listItems, campaignTax);
    const productMap = new Map(hydrated.map((p) => [p.id, p]));

    return orderedIds
      .map((id) => productMap.get(id))
      .filter((p): p is ProductListItem => p != null)
      .slice(0, MAX_HOME_GOLF_PRODUCTS);
  } catch {
    return [];
  }
}

export async function getHomeGolfTourProducts(): Promise<ProductListItem[]> {
  return unstable_cache(getHomeGolfTourProductsUncached, ["home-golf-tour-products"], {
    revalidate: 300,
    tags: ["site-settings"],
  })();
}

/** 홈 골프 섹션 더보기 — published 지역 골프 랜딩 우선, 없으면 채널 URL */
export async function resolveHomeGolfTourMoreHref(
  products: Pick<ProductListItem, "destination_id">[],
): Promise<string> {
  for (const product of products) {
    const href = await getGolfDestinationLandingHrefByDestinationId(product.destination_id);
    if (href) return href;
  }

  const landings = await getPublishedGolfDestinationLandings();
  if (landings.length > 0) return landings[0].href;

  return buildGolfProductsHref();
}
