import { supabase } from "@/lib/supabase";
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
    is_active: typeof row.is_active === "boolean" ? row.is_active : undefined,
    is_featured_home:
      typeof row.is_featured_home === "boolean" ? row.is_featured_home : undefined,
    sort_order: sortOrder,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
  };
}

export async function getProducts() {
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
}

export async function getFeaturedProducts() {
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
}

export async function getProductById(id: string) {
  const { data, error } = await supabase.from("products").select("*").eq("id", id).maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeProduct(data as Record<string, unknown>);
}
