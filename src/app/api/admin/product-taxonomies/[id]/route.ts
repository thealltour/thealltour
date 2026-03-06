import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { supabase } from "@/lib/supabase";
import { parseThemeTokens } from "@/lib/productTaxonomies";
import type { ProductTaxonomyType } from "@/types/productTaxonomy";
import type { Product } from "@/types/product";

type PatchBody = {
  slug?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const taxonomyResult = await supabase
    .from("product_taxonomies")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (taxonomyResult.error || !taxonomyResult.data) {
    return NextResponse.json({ message: "항목을 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json()) as PatchBody;
  const updates: { slug?: string | null; sort_order?: number | null; is_active?: boolean } = {};
  if (body.slug !== undefined) updates.slug = body.slug?.trim() || null;
  if (body.sort_order !== undefined) updates.sort_order = typeof body.sort_order === "number" ? body.sort_order : null;
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "변경할 필드가 없습니다." }, { status: 400 });
  }

  const updateResult = await supabase
    .from("product_taxonomies")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updateResult.error || !updateResult.data) {
    return NextResponse.json({ message: "수정에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.TAXONOMY, REVALIDATE_MAX);
  revalidateTag(CACHE_TAGS.HEADER_NAV, REVALIDATE_MAX);
  return NextResponse.json({ message: "수정되었습니다." });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const taxonomyResult = await supabase
    .from("product_taxonomies")
    .select("id,type,name")
    .eq("id", id)
    .maybeSingle();

  if (taxonomyResult.error || !taxonomyResult.data) {
    return NextResponse.json({ message: "삭제할 항목을 찾을 수 없습니다." }, { status: 404 });
  }

  const type = taxonomyResult.data.type as ProductTaxonomyType;
  const name = String(taxonomyResult.data.name ?? "");
  const productsResult = await supabase.from("products").select("category,theme");
  if (productsResult.error) {
    return NextResponse.json({ message: "상품 목록 조회에 실패했습니다." }, { status: 500 });
  }
  const products = (productsResult.data ?? []) as Product[];

  const inUseCount =
    type === "category"
      ? products.filter((product) => product.category === name).length
      : products.filter((product) => parseThemeTokens(product.theme).includes(name)).length;

  if (inUseCount > 0) {
    return NextResponse.json(
      { message: `현재 ${inUseCount}개 상품에서 사용 중이라 삭제할 수 없습니다.` },
      { status: 400 },
    );
  }

  const deleteResult = await supabase
    .from("product_taxonomies")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (deleteResult.error || !deleteResult.data) {
    return NextResponse.json({ message: "항목 삭제에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.TAXONOMY, REVALIDATE_MAX);
  revalidateTag(CACHE_TAGS.HEADER_NAV, REVALIDATE_MAX);
  return NextResponse.json({ message: "삭제되었습니다." });
}
