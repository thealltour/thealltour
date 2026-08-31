import { getProducts } from "@/lib/products";
import { supabase } from "@/lib/supabase";
import {
  getActiveProductLineTaxonomies,
  getActiveTaxonomiesForHeader,
  getCampaignTaxonomiesForCard,
} from "@/lib/productTaxonomies";
import {
  buildGolfDepartureCalendarData,
  buildGolfDepartureEvents,
  GOLF_CALENDAR_PRODUCT_SELECT,
  mapRowToGolfCalendarEventSource,
  type GolfDepartureEvent,
} from "@/lib/products/golfDepartureCalendar";
import {
  applyProductListingDbFilters,
  normalizeProductListingDbFilters,
  type ProductListingDbFilters,
} from "@/lib/products/productListingQuery";
import {
  buildProductListingQueryParams,
  type BuildProductListingQueryParamsInput,
} from "@/lib/products/buildProductListingQueryParams";
import type { Product } from "@/types/product";

export type GolfDepartureCalendarData = {
  events: GolfDepartureEvent[];
  products: Product[];
  promotionLegendLabel: string | null;
};

/**
 * Home Golf calendar — full catalog path (unchanged).
 * Do not reuse for `/products` Browse calendar.
 */
export async function getGolfDepartureCalendarData(): Promise<GolfDepartureCalendarData> {
  const [products, productLineTaxonomies, headerTaxonomies, campaignTaxonomies] =
    await Promise.all([
      getProducts(),
      getActiveProductLineTaxonomies(),
      getActiveTaxonomiesForHeader(),
      getCampaignTaxonomiesForCard(),
    ]);
  const destinationTaxonomies = headerTaxonomies.filter((t) => t.taxonomy_type === "destination");
  return buildGolfDepartureCalendarData(
    products,
    productLineTaxonomies,
    destinationTaxonomies,
    campaignTaxonomies,
  );
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

  const sources = (data ?? []).map((row) =>
    mapRowToGolfCalendarEventSource(row as unknown as Record<string, unknown>),
  );
  return buildGolfDepartureEvents(
    sources,
    input.destinationNameMap ?? {},
    input.promotionCampaignId ?? null,
  );
}
