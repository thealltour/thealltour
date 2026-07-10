import type { Product } from "@/types/product";
import { ymdToDate } from "@/lib/datePickerUtils";
import { kstTodayYmd } from "@/lib/inquiry/desiredDeparture";
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

/** 달력 초기 선택일: KST 오늘 이후 첫 출발일, 없으면 가장 가까운 과거 출발일 또는 오늘 */
export function resolveGolfCalendarInitialDate(eventYmds: string[]): Date {
  const today = kstTodayYmd();
  const sorted = [...new Set(eventYmds)].sort();
  const upcoming = sorted.find((ymd) => ymd >= today);
  if (upcoming) {
    return ymdToDate(upcoming) ?? new Date();
  }
  const last = sorted[sorted.length - 1];
  if (last) {
    return ymdToDate(last) ?? new Date();
  }
  return new Date();
}

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

    for (const date of collectProductDepartureDates(product, { expandDepartureWindow: true })) {
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

/** 일자별 목록: promotion 상품 우선, 이후 제목 가나다순 */
export function sortGolfDepartureEventsForList(events: GolfDepartureEvent[]): GolfDepartureEvent[] {
  return [...events].sort((a, b) => {
    const promoA = a.isPromotionDeparture ? 0 : 1;
    const promoB = b.isPromotionDeparture ? 0 : 1;
    if (promoA !== promoB) return promoA - promoB;
    return a.title.localeCompare(b.title, "ko");
  });
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
  for (const [date, list] of map) {
    map.set(date, sortGolfDepartureEventsForList(list));
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
