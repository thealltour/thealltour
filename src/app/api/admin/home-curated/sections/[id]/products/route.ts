import { NextResponse } from "next/server";
import { revalidateTag, revalidatePath } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { Product } from "@/types/product";
import type { SectionProductMappingRow } from "@/types/homeCurated";

function normalizeProduct(row: Record<string, unknown>): Product {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    description: String(row.description ?? ""),
    image_url: String(row.image_url ?? ""),
    category: String(row.category ?? "여행상품"),
    theme: typeof row.theme === "string" ? row.theme : undefined,
    price: typeof row.price === "number" ? row.price : undefined,
    is_active: row.is_active === true,
  } as Product;
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: sectionId } = await context.params;

  const sectionCheck = await supabaseAdmin
    .from("home_curated_sections")
    .select("id")
    .eq("id", sectionId)
    .maybeSingle();

  if (sectionCheck.error || !sectionCheck.data) {
    return NextResponse.json({ message: "섹션을 찾을 수 없습니다." }, { status: 404 });
  }

  const { data: mappings, error: mapError } = await supabaseAdmin
    .from("home_curated_section_products")
    .select("*")
    .eq("section_id", sectionId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (mapError) {
    return NextResponse.json({ message: "섹션 상품 목록 조회에 실패했습니다." }, { status: 500 });
  }

  const rows = mappings ?? [];
  if (rows.length === 0) {
    return NextResponse.json([]);
  }

  const productIds = [...new Set(rows.map((r: { product_id: string }) => r.product_id))];
  const { data: products, error: prodError } = await supabaseAdmin
    .from("products")
    .select("*")
    .in("id", productIds);

  if (prodError) {
    return NextResponse.json({ message: "상품 정보 조회에 실패했습니다." }, { status: 500 });
  }

  const productMap = new Map<string, Product>();
  for (const row of products ?? []) {
    const r = row as Record<string, unknown>;
    productMap.set(String(r.id), normalizeProduct(r));
  }

  const result: SectionProductMappingRow[] = rows.map((r: Record<string, unknown>) => ({
    id: String(r.id ?? ""),
    section_id: String(r.section_id ?? ""),
    product_id: String(r.product_id ?? ""),
    sort_order: typeof r.sort_order === "number" ? r.sort_order : 0,
    is_active: r.is_active === true,
    created_at: typeof r.created_at === "string" ? r.created_at : undefined,
    product: productMap.get(String(r.product_id)) ?? null,
  }));

  return NextResponse.json(result);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: sectionId } = await context.params;

  const sectionCheck = await supabaseAdmin
    .from("home_curated_sections")
    .select("id")
    .eq("id", sectionId)
    .maybeSingle();

  if (sectionCheck.error || !sectionCheck.data) {
    return NextResponse.json({ message: "섹션을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json()) as { productId?: string };
  const productId = body.productId?.trim();
  if (!productId) {
    return NextResponse.json({ message: "productId가 필요합니다." }, { status: 400 });
  }

  const existing = await supabaseAdmin
    .from("home_curated_section_products")
    .select("id")
    .eq("section_id", sectionId)
    .eq("product_id", productId)
    .maybeSingle();

  if (existing.data) {
    return NextResponse.json({ message: "이미 이 섹션에 등록된 상품입니다." }, { status: 409 });
  }

  const { data: maxRow } = await supabaseAdmin
    .from("home_curated_section_products")
    .select("sort_order")
    .eq("section_id", sectionId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = typeof maxRow?.sort_order === "number" ? maxRow.sort_order + 1 : 0;

  const insertResult = await supabaseAdmin
    .from("home_curated_section_products")
    .insert({
      section_id: sectionId,
      product_id: productId,
      sort_order: nextOrder,
      is_active: true,
    })
    .select("id, section_id, product_id, sort_order, is_active, created_at")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ message: "상품 추가에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.HOME_CURATED, REVALIDATE_MAX);
  revalidatePath("/");
  return NextResponse.json(insertResult.data, { status: 201 });
}
