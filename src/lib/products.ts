import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import type { Product } from "@/types/product";

const FALLBACK_IMAGE = "https://picsum.photos/seed/thealltour-product/900/560";
const FEATURED_PRODUCT_LIMIT = 8;

function normalizeProduct(row: Record<string, unknown>): Product {
  const rawPrice = row.price;
  const price = typeof rawPrice === "number" ? rawPrice : undefined;
  const sortOrder = typeof row.sort_order === "number" ? row.sort_order : undefined;

  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? row.name ?? "상품명 미정"),
    description: String(row.description ?? row.content ?? "상세 설명이 준비 중입니다."),
    image_url: String(row.image_url ?? row.image ?? FALLBACK_IMAGE),
    category: String(row.category ?? row.type ?? "여행상품"),
    theme: typeof row.theme === "string" ? row.theme : undefined,
    price,
    duration:
      typeof row.duration === "string"
        ? row.duration
        : typeof row.duration_days === "number"
          ? `${row.duration_days}일`
          : undefined,
    itinerary: typeof row.itinerary === "string" ? row.itinerary : undefined,
    inclusions: typeof row.inclusions === "string" ? row.inclusions : undefined,
    point_benefits: typeof row.point_benefits === "string" ? row.point_benefits : undefined,
    point_tourism: typeof row.point_tourism === "string" ? row.point_tourism : undefined,
    point_guide: typeof row.point_guide === "string" ? row.point_guide : undefined,
    meeting_info: typeof row.meeting_info === "string" ? row.meeting_info : undefined,
    travel_insurance: typeof row.travel_insurance === "string" ? row.travel_insurance : undefined,
    included_items: typeof row.included_items === "string" ? row.included_items : undefined,
    excluded_items: typeof row.excluded_items === "string" ? row.excluded_items : undefined,
    detailed_schedule: typeof row.detailed_schedule === "string" ? row.detailed_schedule : undefined,
    optional_tours: typeof row.optional_tours === "string" ? row.optional_tours : undefined,
    terms_and_notes: typeof row.terms_and_notes === "string" ? row.terms_and_notes : undefined,
    terms_template_type:
      typeof row.terms_template_type === "string" ? row.terms_template_type : undefined,
    departure_from_airport:
      typeof row.departure_from_airport === "string" ? row.departure_from_airport : undefined,
    departure_from_date:
      typeof row.departure_from_date === "string" ? row.departure_from_date : undefined,
    departure_from_time:
      typeof row.departure_from_time === "string" ? row.departure_from_time : undefined,
    departure_to_airport:
      typeof row.departure_to_airport === "string" ? row.departure_to_airport : undefined,
    departure_to_date:
      typeof row.departure_to_date === "string" ? row.departure_to_date : undefined,
    departure_to_time:
      typeof row.departure_to_time === "string" ? row.departure_to_time : undefined,
    departure_flight_name:
      typeof row.departure_flight_name === "string" ? row.departure_flight_name : undefined,
    arrival_from_airport:
      typeof row.arrival_from_airport === "string" ? row.arrival_from_airport : undefined,
    arrival_from_date:
      typeof row.arrival_from_date === "string" ? row.arrival_from_date : undefined,
    arrival_from_time:
      typeof row.arrival_from_time === "string" ? row.arrival_from_time : undefined,
    arrival_to_airport:
      typeof row.arrival_to_airport === "string" ? row.arrival_to_airport : undefined,
    arrival_to_date:
      typeof row.arrival_to_date === "string" ? row.arrival_to_date : undefined,
    arrival_to_time:
      typeof row.arrival_to_time === "string" ? row.arrival_to_time : undefined,
    arrival_flight_name:
      typeof row.arrival_flight_name === "string" ? row.arrival_flight_name : undefined,
    meta_title: typeof row.meta_title === "string" ? row.meta_title : undefined,
    meta_description:
      typeof row.meta_description === "string" ? row.meta_description : undefined,
    is_active: typeof row.is_active === "boolean" ? row.is_active : undefined,
    is_featured_home:
      typeof row.is_featured_home === "boolean" ? row.is_featured_home : undefined,
    sort_order: sortOrder,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

export async function getProducts() {
  return getProductsCached();
}

const getProductsCached = unstable_cache(
  async () => {
  const advancedQuery = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (!advancedQuery.error) {
    return (advancedQuery.data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>));
  }

  const fallbackQuery = await supabase.from("products").select("*");
  if (fallbackQuery.error) {
    console.error("[products] list fetch error:", fallbackQuery.error.message);
    return [] as Product[];
  }

  return (fallbackQuery.data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>));
  },
  ["products:list"],
  { revalidate: 60, tags: ["products"] },
);

export async function getFeaturedProducts() {
  return getFeaturedProductsCached();
}

const getFeaturedProductsCached = unstable_cache(
  async () => {
  const featuredAdvancedQuery = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("is_featured_home", true)
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false })
    .limit(FEATURED_PRODUCT_LIMIT);

  if (!featuredAdvancedQuery.error) {
    return (featuredAdvancedQuery.data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>));
  }

  const featuredSimpleQuery = await supabase
    .from("products")
    .select("*")
    .eq("is_active", true)
    .eq("is_featured_home", true)
    .limit(FEATURED_PRODUCT_LIMIT);
  if (!featuredSimpleQuery.error) {
    return (featuredSimpleQuery.data ?? []).map((row) => normalizeProduct(row as Record<string, unknown>));
  }

  const allProducts = await getProducts();
  return allProducts.slice(0, FEATURED_PRODUCT_LIMIT);
  },
  ["products:featured"],
  { revalidate: 60, tags: ["products"] },
);

export async function getProductById(id: string) {
  return getProductByIdCached(id);
}

const getProductByIdCached = unstable_cache(
  async (id: string) => {
    const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();

    if (error || !data) {
      return null;
    }

    return normalizeProduct(data as Record<string, unknown>);
  },
  ["products:by-id"],
  { revalidate: 120, tags: ["products"] },
);
