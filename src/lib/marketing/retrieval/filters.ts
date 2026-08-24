import type { ContentHistoryItem, ProductContext } from "@/lib/marketing/context/types";

export function productMatchesTaxonomy(product: ProductContext, taxonomyId: string): boolean {
  return (
    product.destination?.id === taxonomyId ||
    product.productLine?.id === taxonomyId ||
    product.campaigns.some((campaign) => campaign.id === taxonomyId)
  );
}

export function productMatchesCampaign(product: ProductContext, campaignId: string): boolean {
  return product.campaigns.some((campaign) => campaign.id === campaignId);
}

export function contentRecencyKey(item: ContentHistoryItem): string {
  return item.publishedAt ?? item.createdAt ?? "";
}

export function sortContentHistory(items: ContentHistoryItem[]): ContentHistoryItem[] {
  return [...items].sort((a, b) => contentRecencyKey(b).localeCompare(contentRecencyKey(a)));
}

export function matchesExactChannel(itemChannel: string | null, channel?: string): boolean {
  if (!channel) return true;
  return itemChannel === channel;
}
