import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { parseThemeTokens } from "@/lib/productTaxonomies";
import type { Product } from "@/types/product";
import type { ProductTaxonomyType } from "@/types/productTaxonomy";

type TaxonomyBody = {
  type?: ProductTaxonomyType;
  name?: string;
};

const VALID_TYPES: ProductTaxonomyType[] = ["category", "theme"];

export async function GET() {
  const productsResult = await supabase.from("products").select("category,theme");
  if (productsResult.error) {
    return NextResponse.json({ message: "상품 목록 조회에 실패했습니다." }, { status: 500 });
  }

  const taxonomyResult = await supabase
    .from("product_taxonomies")
    .select("*")
    .order("type", { ascending: true })
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("name", { ascending: true });
  if (taxonomyResult.error) {
    return NextResponse.json(
      { message: "분류 테이블 조회에 실패했습니다. (product_taxonomies SQL 적용 확인)" },
      { status: 500 },
    );
  }

  const products = (productsResult.data ?? []) as Product[];
  const items = (taxonomyResult.data ?? []).map((row) => {
    const type = row.type === "theme" ? "theme" : "category";
    const name = String(row.name ?? "");
    const usageCount =
      type === "category"
        ? products.filter((product) => product.category === name).length
        : products.filter((product) => parseThemeTokens(product.theme).includes(name)).length;
    return {
      id: String(row.id ?? ""),
      type,
      name,
      is_active: typeof row.is_active === "boolean" ? row.is_active : true,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      usageCount,
    };
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const body = (await request.json()) as TaxonomyBody;
  const type = body.type;
  const name = body.name?.trim() ?? "";

  if (!type || !VALID_TYPES.includes(type)) {
    return NextResponse.json({ message: "유효한 타입(category/theme)을 선택해 주세요." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ message: "이름을 입력해 주세요." }, { status: 400 });
  }

  const duplicate = await supabase
    .from("product_taxonomies")
    .select("id")
    .eq("type", type)
    .eq("name", name)
    .maybeSingle();
  if (duplicate.error) {
    return NextResponse.json({ message: "중복 확인 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (duplicate.data) {
    return NextResponse.json({ message: "이미 등록된 항목입니다." }, { status: 409 });
  }

  const insertResult = await supabase
    .from("product_taxonomies")
    .insert({
      type,
      name,
      is_active: true,
    })
    .select("id")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ message: "항목 추가에 실패했습니다." }, { status: 500 });
  }

  if (type === "category") {
    return NextResponse.json({ message: "카테고리가 추가되었습니다." }, { status: 201 });
  }
  return NextResponse.json({ message: "테마가 추가되었습니다." }, { status: 201 });
}
