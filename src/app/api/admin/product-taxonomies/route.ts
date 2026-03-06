import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { supabase } from "@/lib/supabase";
import { parseThemeTokens } from "@/lib/productTaxonomies";
import { getTaxonomyAnalyticsMetrics } from "@/lib/adminAnalytics";
import type { Product } from "@/types/product";
import type { ProductTaxonomyType } from "@/types/productTaxonomy";

type TaxonomyBody = {
  type?: ProductTaxonomyType;
  name?: string;
  slug?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
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
  let metricsByKey: Map<string, { headerClickCount: number; searchInboundCount: number; landingViewCount: number; landingCtr: number | null }> = new Map();
  try {
    const metrics = await getTaxonomyAnalyticsMetrics({ range: "7d" });
    for (const m of metrics) {
      const key = `${m.taxonomyType}:${m.taxonomySlug ?? ""}`;
      metricsByKey.set(key, {
        headerClickCount: m.headerClickCount,
        searchInboundCount: m.searchInboundCount,
        landingViewCount: m.landingViewCount,
        landingCtr: m.landingCtr,
      });
    }
  } catch (err) {
    console.error("[product-taxonomies] analytics metrics failed", err);
  }

  const items = (taxonomyResult.data ?? []).map((row) => {
    const type = row.type === "theme" ? "theme" : "category";
    const name = String(row.name ?? "");
    const slug = typeof row.slug === "string" ? row.slug : null;
    const usageCount =
      type === "category"
        ? products.filter((product) => product.category === name).length
        : products.filter((product) => parseThemeTokens(product.theme).includes(name)).length;
    const slugOrNormalizedName = slug?.trim() || name.trim().toLowerCase().replace(/\s+/g, "-");
    const lookupKey = `${type}:${slugOrNormalizedName}`;
    const metricsRow = metricsByKey.get(lookupKey);
    return {
      id: String(row.id ?? ""),
      type,
      name,
      slug,
      is_active: typeof row.is_active === "boolean" ? row.is_active : true,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      usageCount,
      headerClickCount: metricsRow?.headerClickCount ?? 0,
      searchInboundCount: metricsRow?.searchInboundCount ?? 0,
      landingViewCount: metricsRow?.landingViewCount ?? 0,
      landingCtr: metricsRow?.landingCtr ?? null,
    };
  });
  return NextResponse.json(items);
}

export async function POST(request: Request) {
  const body = (await request.json()) as TaxonomyBody;
  const type = body.type;
  const name = body.name?.trim() ?? "";
  const slug = body.slug?.trim() || null;
  const sort_order = typeof body.sort_order === "number" ? body.sort_order : null;
  const is_active = typeof body.is_active === "boolean" ? body.is_active : true;

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
      slug,
      is_active,
      sort_order,
    })
    .select("id")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ message: "항목 추가에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.TAXONOMY, REVALIDATE_MAX);
  revalidateTag(CACHE_TAGS.HEADER_NAV, REVALIDATE_MAX);
  return NextResponse.json(
    { message: type === "category" ? "카테고리가 추가되었습니다." : "테마가 추가되었습니다." },
    { status: 201 },
  );
}
