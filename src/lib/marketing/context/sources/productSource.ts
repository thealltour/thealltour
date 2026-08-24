import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ProductContextRow } from "@/lib/marketing/context/mappers/productContextMapper";

const PRODUCT_CONTEXT_COLUMNS = [
  "id",
  "title",
  "one_liner",
  "description",
  "status",
  "is_active",
  "price",
  "price_meta",
  "duration",
  "destination_id",
  "product_line_id",
  "campaigns_json",
  "tags_json",
  "selling_points_json",
  "point_benefits",
  "point_tourism",
  "point_guide",
  "inclusions",
  "included_items",
  "excluded_items",
  "optional_tours",
  "optional_expenses",
  "itinerary",
  "detailed_schedule",
  "itinerary_days_json",
  "itinerary_v2_json",
  "departure_schedules_json",
  "overview_accommodation",
  "travel_insurance",
  "booking_notes",
  "travel_notes",
  "refund_policy",
  "images_json",
  "image_url",
  "product_source_url",
].join(", ");

export async function fetchProductRow(productId: string): Promise<ProductContextRow | null> {
  const { data, error } = await supabaseAdmin
    .from("products")
    .select(PRODUCT_CONTEXT_COLUMNS)
    .eq("id", productId)
    .maybeSingle();

  if (error) {
    throw new Error(`products lookup failed: ${error.message}`);
  }
  return (data as ProductContextRow | null) ?? null;
}

export type FetchProductRowsInput = {
  ids?: string[];
  activeOnly?: boolean;
  limit: number;
};

/**
 * Batch product lookup for memory ingestion. Same column projection as fetchProductRow.
 * Does not filter by updated_at — that column is not guaranteed on products.
 */
export async function fetchProductRows(input: FetchProductRowsInput): Promise<ProductContextRow[]> {
  const ids = input.ids?.slice(0, input.limit);
  let query = supabaseAdmin.from("products").select(PRODUCT_CONTEXT_COLUMNS);
  if (ids && ids.length > 0) {
    query = query.in("id", ids);
  }
  if (input.activeOnly) {
    query = query.eq("is_active", true);
  }
  const { data, error } = await query.order("created_at", { ascending: false }).limit(input.limit);
  if (error) {
    throw new Error(`products lookup failed: ${error.message}`);
  }
  return (data as ProductContextRow[] | null) ?? [];
}
