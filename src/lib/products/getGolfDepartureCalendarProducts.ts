import { supabase } from "@/lib/supabase";
import {
  getActiveProductLineTaxonomies,
  getActiveTaxonomiesForHeader,
  getCampaignTaxonomiesForCard,
  buildTaxonomyNameMap,
} from "@/lib/productTaxonomies";
import {
  buildGolfDepartureEvents,
  GOLF_CALENDAR_PRODUCT_SELECT,
  mapRowToGolfCalendarEventSource,
  type GolfCalendarEventSource,
  type GolfDepartureEvent,
} from "@/lib/products/golfDepartureCalendar";
import {
  resolvePromotionCampaignDisplayLabel,
  resolvePromotionCampaignId,
} from "@/lib/products/golfCalendarPromotion";
import {
  buildHomeGolfChannelDbFilter,
} from "@/lib/products/golfChannel";
import {
  applyProductListingDbFilters,
  buildGolfOrFilter,
  normalizeProductListingDbFilters,
  type ProductListingDbFilters,
} from "@/lib/products/productListingQuery";
import {
  buildProductListingQueryParams,
  type BuildProductListingQueryParamsInput,
} from "@/lib/products/buildProductListingQueryParams";
import type { Product } from "@/types/product";
import type { ProductTaxonomy } from "@/types/productTaxonomy";

export type GolfDepartureCalendarData = {
  events: GolfDepartureEvent[];
  /** Home path does not use; kept for type compatibility. */
  products: Product[];
  promotionLegendLabel: string | null;
};

/** PostgREST chunk size — avoid silent default row cap truncation. */
export const HOME_GOLF_CALENDAR_CHUNK_SIZE = 500;

/**
 * Home Golf calendar: DB golf-channel filter → slim GolfCalendarEventSource rows.
 * No getProducts() / full Product / normalizeProduct.
 */
export async function getHomeGolfDepartureCalendarEventSources(
  productLineTaxonomies: ProductTaxonomy[],
): Promise<GolfCalendarEventSource[]> {
  const golfFilter = buildHomeGolfChannelDbFilter(productLineTaxonomies);
  const golfOr = buildGolfOrFilter({
    productLineIds: golfFilter.productLineIds,
    legacyCategories: [...golfFilter.legacyCategories],
  });
  if (!golfOr) return [];

  const out: GolfCalendarEventSource[] = [];
  let from = 0;

  for (;;) {
    const to = from + HOME_GOLF_CALENDAR_CHUNK_SIZE - 1;
    const { data, error } = await supabase
      .from("products")
      .select(GOLF_CALENDAR_PRODUCT_SELECT)
      .eq("is_active", true)
      .or(golfOr)
      .order("id", { ascending: true, nullsFirst: false })
      .range(from, to);

    if (error) {
      console.error("[home-golf-calendar] source fetch error:", error.message);
      throw new Error(`[home-golf-calendar] source fetch failed: ${error.message}`);
    }

    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    for (const row of rows) {
      out.push(mapRowToGolfCalendarEventSource(row));
    }

    if (rows.length < HOME_GOLF_CALENDAR_CHUNK_SIZE) break;
    from += HOME_GOLF_CALENDAR_CHUNK_SIZE;
  }

  return out;
}

/**
 * Home Golf calendar — slim golf-channel sources (POST-UI-01D-3A).
 * Do not reuse for `/products` Browse calendar.
 */
export async function getGolfDepartureCalendarData(): Promise<GolfDepartureCalendarData> {
  const [productLineTaxonomies, headerTaxonomies, campaignTaxonomies] =
    await Promise.all([
      getActiveProductLineTaxonomies(),
      getActiveTaxonomiesForHeader(),
      getCampaignTaxonomiesForCard(),
    ]);

  const sources = await getHomeGolfDepartureCalendarEventSources(productLineTaxonomies);

  const destinationTaxonomies = headerTaxonomies.filter(
    (t) => t.taxonomy_type === "destination",
  );
  const destinationNameMap = buildTaxonomyNameMap(destinationTaxonomies);
  const promotionCampaignId = resolvePromotionCampaignId(campaignTaxonomies);
  const promotionLegendLabel = resolvePromotionCampaignDisplayLabel(campaignTaxonomies);
  const events = buildGolfDepartureEvents(
    sources,
    destinationNameMap,
    promotionCampaignId,
  );

  return { events, products: [], promotionLegendLabel };
}

/**
 * Browse Golf calendar filters: same listing contract, page/sort stripped.
 */
export function buildGolfCalendarListingFilters(
  input: BuildProductListingQueryParamsInput,
): ProductListingDbFilters {
  const params = buildProductListingQueryParams({
    filters: {
      ...input.filters,
      page: undefined,
      pageSize: undefined,
      sort: undefined,
    },
    taxonomy: input.taxonomy,
  });
  return params.filters ?? {};
}

export type GetFilteredGolfDepartureCalendarEventsInput = {
  filters: ProductListingDbFilters;
  destinationNameMap?: Record<string, string>;
  promotionCampaignId?: string | null;
};

/**
 * `/products` Golf calendar: filtered universe slim rows → events.
 * No page range, no arbitrary limit, no getProducts() full catalog.
 */
export async function getFilteredGolfDepartureCalendarEvents(
  input: GetFilteredGolfDepartureCalendarEventsInput,
): Promise<GolfDepartureEvent[]> {
  const filters = normalizeProductListingDbFilters(input.filters);
  if (filters.matchNone) {
    return [];
  }

  let query = supabase
    .from("products")
    .select(GOLF_CALENDAR_PRODUCT_SELECT)
    .eq("is_active", true);

  query = applyProductListingDbFilters(query, filters);
  query = query.order("id", { ascending: true, nullsFirst: false });

  const { data, error } = await query;
  if (error) {
    console.error("[golf-calendar] filtered fetch error:", error.message);
    throw new Error(`[golf-calendar] filtered fetch failed: ${error.message}`);
  }

  const sources = (data ?? []) as unknown as Record<string, unknown>[];
  return buildGolfDepartureEvents(
    sources.map((row) => mapRowToGolfCalendarEventSource(row)),
    input.destinationNameMap ?? {},
    input.promotionCampaignId ?? null,
  );
}
