import {
  getSiteSettings,
  parseProductsCollectionPopularCampaignIds,
  parseProductsCollectionRecommendCampaignIds,
} from "@/lib/siteSettings";
import { resolveCampaignTaxonomyNamesByIds } from "@/lib/products/resolveCampaignTaxonomyNames";

/** `/products` 및 (선택) 랜딩 하단 목록에서 `collection=recommend|popular` 매칭용. */
export async function getCollectionCampaignNamesForListing(): Promise<{
  recommend: string[];
  popular: string[];
}> {
  const siteSettings = await getSiteSettings();
  const recIds = parseProductsCollectionRecommendCampaignIds(siteSettings);
  const popIds = parseProductsCollectionPopularCampaignIds(siteSettings);
  const [recommend, popular] = await Promise.all([
    resolveCampaignTaxonomyNamesByIds(recIds),
    resolveCampaignTaxonomyNamesByIds(popIds),
  ]);
  return { recommend, popular };
}
