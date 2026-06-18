import type { Product } from "@/types/product";
import { filterGolfChannelProducts } from "@/lib/products/golfChannel";
import {
  productHasPromotionCampaign,
  resolvePromotionCampaignDisplayLabel,
  resolvePromotionCampaignId,
} from "@/lib/products/golfCalendarPromotion";
import { collectProductDepartureDates } from "@/lib/products/productDepartureDates";
import { getPrimaryImageUrl } from "@/lib/products/images";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { buildTaxonomyNameMap } from "@/lib/productTaxonomies";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

export type GolfDepartureEvent = {
  date: string;
  productId: string;
  title: string;
  href: string;
  price?: number;
  imageUrl?: string;
  regionLabel?: string;
  isPromotionDeparture?: boolean;
};

export type GolfDepartureCalendarBuildResult = {
  events: GolfDepartureEvent[];
  products: Product[];
  promotionLegendLabel: string | null;
};

function resolveProductRegionLabel(
  product: Product,
  destinationNameMap: Record<string, string> = {},
): string {
  const overview = product.overview_region?.trim();
  if (overview) return overview;

  const destId = product.destination_id?.trim();
  if (destId && destinationNameMap[destId]?.trim()) {
    return destinationNameMap[destId].trim();
  }

  return product.category?.trim() || product.theme?.trim() || "";
}

function resolveProductImageUrl(product: Product): string | undefined {
  const raw = getPrimaryImageUrl(product)?.trim();
  if (!raw) return undefined;
  const normalized = normalizeProductImageUrl(raw);
  return normalized || raw;
}

export function buildGolfDepartureEvents(
  products: Product[],
  destinationNameMap: Record<string, string> = {},
  promotionCampaignId: string | null = null,
): GolfDepartureEvent[] {
  const events: GolfDepartureEvent[] = [];
  for (const product of products) {
    const regionLabel = resolveProductRegionLabel(product, destinationNameMap);
    const imageUrl = resolveProductImageUrl(product);
    const isPromotion = productHasPromotionCampaign(product, promotionCampaignId);

    for (const date of collectProductDepartureDates(product)) {
      events.push({
        date,
        productId: product.id,
        title: product.title,
        href: `/products/${product.id}`,
        price: product.price,
        imageUrl,
        regionLabel: regionLabel || undefined,
        isPromotionDeparture: isPromotion || undefined,
      });
    }
  }
  return events.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ko"));
}

export function groupGolfDepartureEventsByDate(
  events: GolfDepartureEvent[],
): Map<string, GolfDepartureEvent[]> {
  const map = new Map<string, GolfDepartureEvent[]>();
  for (const event of events) {
    const list = map.get(event.date);
    if (list) list.push(event);
    else map.set(event.date, [event]);
  }
  return map;
}

export function buildGolfDepartureCalendarData(
  products: Product[],
  productLineTaxonomies: ProductTaxonomy[],
  destinationTaxonomies: ProductTaxonomy[] = [],
  campaignTaxonomies: ProductTaxonomy[] = [],
): GolfDepartureCalendarBuildResult {
  const productLineNameMap = buildTaxonomyNameMap(productLineTaxonomies);
  const destinationNameMap = buildTaxonomyNameMap(destinationTaxonomies);
  const promotionCampaignId = resolvePromotionCampaignId(campaignTaxonomies);
  const promotionLegendLabel = resolvePromotionCampaignDisplayLabel(campaignTaxonomies);
  const golfProducts = filterGolfChannelProducts(products, productLineNameMap);
  const events = buildGolfDepartureEvents(golfProducts, destinationNameMap, promotionCampaignId);
  return { events, products: golfProducts, promotionLegendLabel };
}
