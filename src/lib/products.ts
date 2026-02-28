import { supabase } from "@/lib/supabase";
import { unstable_cache } from "next/cache";
import type { Product, ProductTrust, ProductOptions, ProductOptionGroup, ProductOptionItem } from "@/types/product";

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
    min_departure_people: typeof row.min_departure_people === "string" ? row.min_departure_people : undefined,
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
    status:
      row.status === "AVAILABLE" ||
      row.status === "LIMITED" ||
      row.status === "SOLD_OUT" ||
      row.status === "CONSULT_REQUIRED"
        ? row.status
        : undefined,
    fuel_included:
      row.fuel_included === true ? true : row.fuel_included === false ? false : undefined,
    price_meta: typeof row.price_meta === "string" && row.price_meta.trim() !== "" ? row.price_meta.trim() : undefined,
    meta_info: typeof row.meta_info === "string" && row.meta_info.trim() !== "" ? row.meta_info.trim() : undefined,
    one_liner: typeof row.one_liner === "string" && row.one_liner.trim() !== "" ? row.one_liner.trim() : undefined,
    trust: normalizeTrust(row.trust),
    options: normalizeOptions(row.options, typeof row.price === "number" ? row.price : undefined),
  };
}

function normalizeTrust(raw: unknown): ProductTrust | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const recentConsultCount = typeof o.recentConsultCount === "number" ? o.recentConsultCount : undefined;
  const recentDays = typeof o.recentDays === "number" ? o.recentDays : undefined;
  const totalInquiries = typeof o.totalInquiries === "number" ? o.totalInquiries : undefined;
  const ratingAvg = typeof o.ratingAvg === "number" ? o.ratingAvg : undefined;
  const reviewCount = typeof o.reviewCount === "number" ? o.reviewCount : undefined;
  if (
    recentConsultCount === undefined &&
    recentDays === undefined &&
    totalInquiries === undefined &&
    ratingAvg === undefined &&
    reviewCount === undefined
  ) {
    return undefined;
  }
  return {
    recentConsultCount,
    recentDays,
    totalInquiries,
    ratingAvg,
    reviewCount,
  };
}

function normalizeOptionItem(raw: unknown): ProductOptionItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const value = typeof o.value === "string" ? o.value : typeof o.id === "string" ? o.id : undefined;
  const label = typeof o.label === "string" ? o.label : undefined;
  if (!value || !label) return null;
  return {
    value,
    label,
    priceDelta: typeof o.priceDelta === "number" ? o.priceDelta : undefined,
    meta: typeof o.meta === "string" ? o.meta : undefined,
    isDefault: o.isDefault === true,
  };
}

function normalizeOptionGroup(raw: unknown): ProductOptionGroup | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const key = typeof o.key === "string" ? o.key : typeof o.id === "string" ? o.id : undefined;
  const title = typeof o.title === "string" ? o.title : typeof o.label === "string" ? o.label : undefined;
  const type =
    o.type === "radio" || o.type === "select" || o.type === "stepper" || o.type === "multi"
      ? o.type
      : "radio";
  const rawItems = Array.isArray(o.items) ? o.items : Array.isArray(o.options) ? o.options : [];
  const items = rawItems.map((item: unknown) => normalizeOptionItem(item)).filter((x): x is ProductOptionItem => x !== null);
  if (!key || !title || items.length === 0) return null;
  return { key, title, type, items };
}

/** 신규: { basePrice, currency, groups }. 레거시: 그룹 배열 → basePrice는 productPrice 사용 */
function normalizeOptions(raw: unknown, productPrice?: number): ProductOptions | undefined {
  const fallbackBase = typeof productPrice === "number" ? productPrice : 0;

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const basePrice = typeof o.basePrice === "number" ? o.basePrice : fallbackBase;
    const currency = o.currency === "KRW" ? "KRW" : "KRW";
    const rawGroups = Array.isArray(o.groups) ? o.groups : [];
    const groups = rawGroups.map((g: unknown) => normalizeOptionGroup(g)).filter((x): x is ProductOptionGroup => x !== null);
    const requiredGroups = Array.isArray(o.requiredGroups)
      ? (o.requiredGroups as string[]).filter((k): k is string => typeof k === "string")
      : undefined;
    if (groups.length === 0) return undefined;
    return { basePrice, currency, requiredGroups, groups };
  }

  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const legacyGroups = raw.map((item: unknown) => normalizeOptionGroup(item)).filter((x): x is ProductOptionGroup => x !== null);
  if (legacyGroups.length === 0) return undefined;
  const requiredKeys = (raw as Record<string, unknown>[])
    .filter((r) => r.required === true)
    .map((r) => (typeof r.key === "string" ? r.key : typeof r.id === "string" ? r.id : null))
    .filter((k): k is string => k != null);
  return {
    basePrice: fallbackBase,
    currency: "KRW",
    requiredGroups: requiredKeys.length > 0 ? requiredKeys : undefined,
    groups: legacyGroups,
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
