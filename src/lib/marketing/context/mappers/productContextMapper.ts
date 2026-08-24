import { normalizeSellingPoints } from "@/lib/products/normalizeSellingPoints";
import { asBoolean, asNumber, asString, asStringArray, asUnknownJson } from "@/lib/marketing/context/json";
import { isUuid } from "@/lib/marketing/context/validation";
import { mapTaxonomyRowToContext, type ProductTaxonomyRow } from "@/lib/marketing/context/mappers/taxonomyContextMapper";
import type { ProductContext, TaxonomyContext } from "@/lib/marketing/context/types";

export type ProductContextRow = {
  id?: unknown;
  title?: unknown;
  one_liner?: unknown;
  description?: unknown;
  status?: unknown;
  is_active?: unknown;
  price?: unknown;
  price_meta?: unknown;
  duration?: unknown;
  destination_id?: unknown;
  product_line_id?: unknown;
  campaigns_json?: unknown;
  tags_json?: unknown;
  selling_points_json?: unknown;
  point_benefits?: unknown;
  point_tourism?: unknown;
  point_guide?: unknown;
  inclusions?: unknown;
  included_items?: unknown;
  excluded_items?: unknown;
  optional_tours?: unknown;
  optional_expenses?: unknown;
  itinerary?: unknown;
  detailed_schedule?: unknown;
  itinerary_days_json?: unknown;
  itinerary_v2_json?: unknown;
  departure_schedules_json?: unknown;
  overview_accommodation?: unknown;
  travel_insurance?: unknown;
  booking_notes?: unknown;
  travel_notes?: unknown;
  refund_policy?: unknown;
  images_json?: unknown;
  image_url?: unknown;
  product_source_url?: unknown;
};

export function collectProductTaxonomyIds(row: ProductContextRow): string[] {
  const ids = new Set<string>();
  const destinationId = asString(row.destination_id);
  const productLineId = asString(row.product_line_id);
  if (destinationId && isUuid(destinationId)) ids.add(destinationId);
  if (productLineId && isUuid(productLineId)) ids.add(productLineId);
  for (const token of asStringArray(row.campaigns_json)) {
    if (isUuid(token)) ids.add(token);
  }
  return [...ids];
}

export function mapProductRowToContext(
  row: ProductContextRow,
  taxonomiesById: Map<string, ProductTaxonomyRow> = new Map(),
): ProductContext | null {
  const id = asString(row.id);
  const title = asString(row.title);
  if (!id || !title) return null;

  const sellingPoints = normalizeSellingPoints(row.selling_points_json) ?? null;
  const destination = mapTaxonomyById(asString(row.destination_id), taxonomiesById);
  const productLine = mapTaxonomyById(asString(row.product_line_id), taxonomiesById);

  const campaigns: TaxonomyContext[] = [];
  const unresolvedCampaignLabels: string[] = [];
  for (const token of asStringArray(row.campaigns_json)) {
    if (isUuid(token)) {
      const mapped = mapTaxonomyById(token, taxonomiesById);
      if (mapped) campaigns.push(mapped);
      else unresolvedCampaignLabels.push(token);
    } else {
      unresolvedCampaignLabels.push(token);
    }
  }

  const images = asStringArray(row.images_json);
  const imageUrl = asString(row.image_url);
  if (imageUrl && !images.includes(imageUrl)) images.unshift(imageUrl);

  return {
    id,
    title,
    oneLiner: asString(row.one_liner),
    description: asString(row.description),
    status: asString(row.status),
    isActive: asBoolean(row.is_active, true),
    price: asNumber(row.price),
    priceMeta: asString(row.price_meta),
    duration: asString(row.duration),
    destination,
    productLine,
    campaigns,
    unresolvedCampaignLabels,
    tags: asStringArray(row.tags_json),
    sellingPoints,
    benefits: asString(row.point_benefits),
    tourismPoints: asString(row.point_tourism),
    guidePoints: asString(row.point_guide),
    inclusions: asString(row.inclusions),
    includedItems: asString(row.included_items),
    exclusions: asString(row.excluded_items),
    optionalTours: asString(row.optional_tours),
    optionalExpenses: asString(row.optional_expenses),
    itinerary: asString(row.itinerary),
    detailedSchedule: asString(row.detailed_schedule),
    itineraryDays: asUnknownJson(row.itinerary_days_json),
    itineraryV2: asUnknownJson(row.itinerary_v2_json),
    departureSchedules: asUnknownJson(row.departure_schedules_json),
    accommodation: asString(row.overview_accommodation),
    transportation: sellingPoints?.transport ?? null,
    insurance: asString(row.travel_insurance) ?? sellingPoints?.insurance ?? null,
    bookingNotes: asString(row.booking_notes),
    travelNotes: asString(row.travel_notes),
    refundPolicy: asString(row.refund_policy),
    images,
    sourceUrl: asString(row.product_source_url),
  };
}

function mapTaxonomyById(
  id: string | null,
  taxonomiesById: Map<string, ProductTaxonomyRow>,
): TaxonomyContext | null {
  if (!id) return null;
  return mapTaxonomyRowToContext(taxonomiesById.get(id));
}
