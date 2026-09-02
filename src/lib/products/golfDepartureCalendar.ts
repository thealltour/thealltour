import type { Product } from "@/types/product";
import { dateToYmd, ymdToDate } from "@/lib/datePickerUtils";
import { buildGolfProductsHref } from "@/lib/products/golfChannel";
import { kstTodayYmd } from "@/lib/inquiry/desiredDeparture";
import { filterGolfChannelProducts } from "@/lib/products/golfChannel";
import {
  productHasPromotionCampaign,
  resolvePromotionCampaignDisplayLabel,
  resolvePromotionCampaignId,
  type PromotionCampaignSource,
} from "@/lib/products/golfCalendarPromotion";
import {
  collectProductDepartureDates,
  type ProductDepartureDateSource,
} from "@/lib/products/productDepartureDates";
import { getPrimaryImageUrl } from "@/lib/products/images";
import { normalizeProductImageUrl } from "@/lib/media/normalizeProductImageUrl";
import { buildTaxonomyNameMap } from "@/lib/productTaxonomies";
import {
  deriveDeparturesFromSchedules,
  normalizeDepartureSchedulesFromUnknown,
} from "@/lib/products/normalizeDepartureSchedules";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

/** Minimal product shape for calendar event generation (listing Product is compatible). */
export type GolfCalendarEventSource = ProductDepartureDateSource &
  PromotionCampaignSource & {
    id: string;
    title: string;
    price?: number;
    destination_id?: string | null;
    product_line_id?: string | null;
    category?: string;
    theme?: string;
    overview_region?: string | null;
    image_url?: string;
    images_json?: string[];
  };

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

/** Home responsive golf calendar — RSC/client 공통 serializable model */
export type HomeGolfCalendarModel = {
  /** 표시 월 1일 (YYYY-MM-DD) */
  initialMonthYmd: string;
  /** 초기 선택일 (KST today 이후 첫 출발일 등) */
  initialSelectedYmd: string;
  /** 전체 unique 출발일 YMD */
  availableYmds: string[];
  /** initial month 내 unique 출발일 수 */
  monthAvailableDayCount: number;
  /** 전체 unique 출발일 수 */
  totalAvailableDays: number;
  eventsByDate: Record<string, GolfDepartureEvent[]>;
  href: string;
  promotionLegendLabel: string | null;
};

const HOME_GOLF_CALENDAR_DEFAULT_HREF = buildGolfProductsHref();

/** PostgREST projection for /products Golf calendar universe (not listing DTO). */
export const GOLF_CALENDAR_PRODUCT_SELECT = [
  "id",
  "title",
  "price",
  "destination_id",
  "product_line_id",
  "category",
  "theme",
  "overview_region",
  "image_url",
  "images_json",
  "departure_schedules_json",
  "departure_from_date",
  "departure_to_date",
  "campaigns_json",
].join(",");

/** Heavy PDP fields excluded from calendar projection. */
export const GOLF_CALENDAR_EXCLUDED_HEAVY_COLUMNS = [
  "description",
  "itinerary",
  "itinerary_v2_json",
  "package_catalog_json",
  "golf_courses_json",
  "selling_points_json",
  "options",
  "notes",
] as const;

function normalizeStringArray(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return out.length > 0 ? out : undefined;
}

function normalizeImageList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out = raw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
  return out.length > 0 ? out : undefined;
}

/** DB slim row → calendar event source (no full normalizeProduct). */
export function mapRowToGolfCalendarEventSource(
  row: Record<string, unknown>,
): GolfCalendarEventSource {
  const departureSchedules =
    normalizeDepartureSchedulesFromUnknown(row.departure_schedules_json) ?? undefined;
  const fromSchedules = deriveDeparturesFromSchedules(departureSchedules);
  const departures =
    fromSchedules ??
    normalizeStringArray(row.departures ?? row.departures_json) ??
    undefined;

  const priceRaw = row.price;
  let price: number | undefined;
  if (typeof priceRaw === "number" && Number.isFinite(priceRaw)) {
    price = priceRaw;
  } else if (priceRaw != null && priceRaw !== "") {
    const n = Number(priceRaw);
    if (Number.isFinite(n)) price = n;
  }

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    price,
    destination_id:
      row.destination_id != null && String(row.destination_id).trim()
        ? String(row.destination_id)
        : null,
    product_line_id:
      row.product_line_id != null && String(row.product_line_id).trim()
        ? String(row.product_line_id)
        : null,
    category: row.category != null ? String(row.category) : undefined,
    theme: typeof row.theme === "string" ? row.theme : undefined,
    overview_region:
      typeof row.overview_region === "string" ? row.overview_region : undefined,
    image_url: typeof row.image_url === "string" ? row.image_url : undefined,
    images_json: normalizeImageList(row.images_json),
    departureSchedules,
    departures,
    departure_from_date:
      typeof row.departure_from_date === "string" ? row.departure_from_date : undefined,
    departure_to_date:
      typeof row.departure_to_date === "string" ? row.departure_to_date : undefined,
    campaigns: normalizeStringArray(row.campaigns_json ?? row.campaigns),
    campaigns_json: normalizeStringArray(row.campaigns_json ?? row.campaigns),
  };
}

/** Home calendar DTO — events[]에서 Preview/Desktop 공통 model 생성 */
export function buildHomeGolfCalendarModel(
  events: GolfDepartureEvent[],
  href: string = HOME_GOLF_CALENDAR_DEFAULT_HREF,
  promotionLegendLabel: string | null = null,
): HomeGolfCalendarModel | null {
  if (events.length === 0) return null;

  const eventYmds = events.map((event) => event.date);
  const initialDate = resolveGolfCalendarInitialDate(eventYmds);
  const initialSelectedYmd = dateToYmd(initialDate);
  const initialMonthYmd = dateToYmd(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  if (!initialSelectedYmd || !initialMonthYmd) return null;

  const availableYmds = [...new Set(eventYmds)].sort();
  const monthPrefix = initialMonthYmd.slice(0, 7);
  const monthAvailableDayCount = availableYmds.filter((ymd) =>
    ymd.startsWith(monthPrefix),
  ).length;

  const grouped = groupGolfDepartureEventsByDate(events);
  const eventsByDate: Record<string, GolfDepartureEvent[]> = {};
  for (const [ymd, list] of grouped) {
    eventsByDate[ymd] = list;
  }

  return {
    initialMonthYmd,
    initialSelectedYmd,
    availableYmds,
    monthAvailableDayCount,
    totalAvailableDays: availableYmds.length,
    eventsByDate,
    href: href.trim() || HOME_GOLF_CALENDAR_DEFAULT_HREF,
    promotionLegendLabel,
  };
}

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
  product: GolfCalendarEventSource,
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

function resolveProductImageUrl(product: GolfCalendarEventSource): string | undefined {
  const raw = getPrimaryImageUrl({
    image_url: product.image_url ?? "",
    images_json: product.images_json,
  })?.trim();
  if (!raw) return undefined;
  const normalized = normalizeProductImageUrl(raw);
  return normalized || raw;
}

export function buildGolfDepartureEvents(
  products: GolfCalendarEventSource[],
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
