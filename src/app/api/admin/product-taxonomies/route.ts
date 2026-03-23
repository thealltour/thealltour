import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { supabase } from "@/lib/supabase";
import { parseThemeTokens } from "@/lib/productTaxonomies";
import { getTaxonomyAnalyticsMetrics } from "@/lib/adminAnalytics";
import type { Product } from "@/types/product";
import type { ProductTaxonomyType, ProductCategoryType, TaxonomyType } from "@/types/productTaxonomy";

/**
 * 관리자 taxonomy API (PR-TAX-2).
 * - 조회/생성/수정은 taxonomy_type 기준. GET ?taxonomy_type= 필터, POST/PATCH 에서 taxonomy_type 저장·검증.
 * - 검증: taxonomy_type 허용값, name 필수, slug 형식(영문 소문자/숫자/하이픈) 및 동일 taxonomy_type 내 중복, is_hub_visible/is_landing_enabled boolean.
 * - 기존 type/category_type 은 deprecated. 신규 클라이언트는 taxonomy_type 만 사용 권장. legacy 요청(type/category_type)도 호환 처리.
 */
const TAXONOMY_TYPE_VALUES: TaxonomyType[] = ["destination", "theme", "product_line", "campaign", "tag"];
function parseTaxonomyType(val: unknown): TaxonomyType {
  if (typeof val === "string" && TAXONOMY_TYPE_VALUES.includes(val as TaxonomyType)) return val as TaxonomyType;
  return "destination";
}

type TaxonomyBody = {
  /** 신규 권장. 없으면 legacy type/category_type 사용 */
  taxonomy_type?: TaxonomyType;
  /** @deprecated taxonomy_type 사용 */
  type?: ProductTaxonomyType;
  name?: string;
  slug?: string | null;
  sort_order?: number | null;
  /** 상위 분류 id (대분류). 동일 taxonomy_type만 허용 */
  parent_id?: string | null;
  is_active?: boolean;
  /** @deprecated taxonomy_type 사용 */
  category_type?: ProductCategoryType | null;
  is_hub_visible?: boolean;
  is_landing_enabled?: boolean;
  card_image_url?: string | null;
  card_title?: string | null;
  card_description?: string | null;
  landing_title?: string | null;
  landing_description?: string | null;
  hero_image_url?: string | null;
  /** PR3: campaign 카드 배지 CMS */
  display_label?: string | null;
  badge_priority?: number | null;
  badge_visible?: boolean;
  badge_tone?: string | null;
  badge_description?: string | null;
};

const VALID_TYPES: ProductTaxonomyType[] = ["category", "theme"];
const VALID_CATEGORY_TYPES: ProductCategoryType[] = ["destination", "product_line", "highlight", "other"];

/** taxonomy_type -> legacy type (DB 컬럼 호환) */
function taxonomyTypeToLegacyType(tt: TaxonomyType): ProductTaxonomyType {
  return tt === "theme" ? "theme" : "category";
}

/** taxonomy_type -> legacy category_type (category일 때만) */
function taxonomyTypeToLegacyCategoryType(tt: TaxonomyType): ProductCategoryType | null {
  if (tt === "destination") return "destination";
  if (tt === "product_line") return "product_line";
  if (tt === "campaign") return "highlight";
  return null;
}

/** legacy type + category_type -> taxonomy_type */
function legacyToTaxonomyType(
  type: ProductTaxonomyType,
  category_type?: ProductCategoryType | null,
): TaxonomyType {
  if (type === "theme") return "theme";
  if (category_type === "destination") return "destination";
  if (category_type === "product_line") return "product_line";
  if (category_type === "highlight" || category_type === "other") return "campaign";
  return "destination";
}

/** URL-safe slug 검증: 영문 소문자, 숫자, 하이픈만 허용 */
function isUrlSafeSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) || s === "";
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taxonomyTypeParam = searchParams.get("taxonomy_type")?.trim() ?? "";
  const filterByType =
    taxonomyTypeParam !== "" && TAXONOMY_TYPE_VALUES.includes(taxonomyTypeParam as TaxonomyType)
      ? (taxonomyTypeParam as TaxonomyType)
      : null;

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
    const r = row as Record<string, unknown>;
    const taxonomy_type: TaxonomyType =
      r.taxonomy_type != null && String(r.taxonomy_type).trim() !== ""
        ? parseTaxonomyType(r.taxonomy_type)
        : type === "theme"
          ? "theme"
          : "destination";
    const usageCount =
      taxonomy_type === "theme"
        ? products.filter((product) => parseThemeTokens(product.theme).includes(name)).length
        : products.filter((product) => product.category === name).length;
    const slugOrNormalizedName = slug?.trim() || name.trim().toLowerCase().replace(/\s+/g, "-");
    const lookupKey = `${type}:${slugOrNormalizedName}`;
    const metricsRow = metricsByKey.get(lookupKey);
    return {
      id: String(row.id ?? ""),
      taxonomy_type,
      type,
      name,
      slug,
      parent_id: r.parent_id != null ? String(r.parent_id) : null,
      is_active: typeof row.is_active === "boolean" ? row.is_active : true,
      sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
      created_at: typeof row.created_at === "string" ? row.created_at : null,
      category_type: type === "category" && r.category_type != null ? (r.category_type as ProductCategoryType) : undefined,
      is_hub_visible: typeof r.is_hub_visible === "boolean" ? r.is_hub_visible : true,
      is_landing_enabled: typeof r.is_landing_enabled === "boolean" ? r.is_landing_enabled : false,
      card_image_url: typeof r.card_image_url === "string" ? r.card_image_url.trim() || null : null,
      card_title: typeof r.card_title === "string" ? r.card_title.trim() || null : null,
      card_description: typeof r.card_description === "string" ? r.card_description.trim() || null : null,
      landing_title: typeof r.landing_title === "string" ? r.landing_title.trim() || null : null,
      landing_description: typeof r.landing_description === "string" ? r.landing_description.trim() || null : null,
      hero_image_url: typeof r.hero_image_url === "string" ? r.hero_image_url.trim() || null : null,
      usageCount,
      headerClickCount: metricsRow?.headerClickCount ?? 0,
      searchInboundCount: metricsRow?.searchInboundCount ?? 0,
      landingViewCount: metricsRow?.landingViewCount ?? 0,
      landingCtr: metricsRow?.landingCtr ?? null,
      display_label: typeof r.display_label === "string" ? r.display_label.trim() || null : null,
      badge_priority:
        typeof r.badge_priority === "number" && Number.isFinite(r.badge_priority)
          ? r.badge_priority
          : null,
      badge_visible: typeof r.badge_visible === "boolean" ? r.badge_visible : true,
      badge_tone: typeof r.badge_tone === "string" ? r.badge_tone.trim() || null : null,
      badge_description:
        typeof r.badge_description === "string" ? r.badge_description.trim() || null : null,
    };
  });

  const filtered = filterByType
    ? items.filter((i) => i.taxonomy_type === filterByType)
    : items;
  return NextResponse.json(filtered);
}

export async function POST(request: Request) {
  const body = (await request.json()) as TaxonomyBody;
  const name = body.name?.trim() ?? "";
  let slug = body.slug?.trim() || null;
  const sort_order = typeof body.sort_order === "number" ? body.sort_order : null;
  const is_active = typeof body.is_active === "boolean" ? body.is_active : true;
  const is_hub_visible = typeof body.is_hub_visible === "boolean" ? body.is_hub_visible : true;
  const is_landing_enabled = typeof body.is_landing_enabled === "boolean" ? body.is_landing_enabled : false;

  let taxonomy_type: TaxonomyType;
  let type: ProductTaxonomyType;
  let category_type: ProductCategoryType | null = null;

  if (
    body.taxonomy_type != null &&
    TAXONOMY_TYPE_VALUES.includes(body.taxonomy_type as TaxonomyType)
  ) {
    taxonomy_type = body.taxonomy_type as TaxonomyType;
    type = taxonomyTypeToLegacyType(taxonomy_type);
    category_type = taxonomyTypeToLegacyCategoryType(taxonomy_type);
  } else if (body.type && VALID_TYPES.includes(body.type)) {
    type = body.type;
    category_type =
      type === "category" && body.category_type != null && VALID_CATEGORY_TYPES.includes(body.category_type)
        ? body.category_type
        : null;
    taxonomy_type = legacyToTaxonomyType(type, category_type);
  } else {
    return NextResponse.json(
      { message: "taxonomy_type(권장) 또는 type(category/theme)을 지정해 주세요." },
      { status: 400 },
    );
  }

  if (!name) {
    return NextResponse.json({ message: "이름을 입력해 주세요." }, { status: 400 });
  }
  if (slug !== null && slug !== "" && !isUrlSafeSlug(slug)) {
    return NextResponse.json(
      { message: "slug는 영문 소문자, 숫자, 하이픈만 사용 가능합니다." },
      { status: 400 },
    );
  }
  if (slug === "") slug = null;

  const parent_id =
    body.parent_id === null || body.parent_id === ""
      ? null
      : typeof body.parent_id === "string" && body.parent_id.trim() !== ""
        ? body.parent_id.trim()
        : null;

  if (parent_id != null) {
    const parentRow = await supabase
      .from("product_taxonomies")
      .select("id, taxonomy_type")
      .eq("id", parent_id)
      .maybeSingle();
    if (parentRow.error || !parentRow.data) {
      return NextResponse.json({ message: "선택한 대분류를 찾을 수 없습니다." }, { status: 400 });
    }
    const pt = (parentRow.data as { taxonomy_type?: string }).taxonomy_type;
    if (pt !== taxonomy_type) {
      return NextResponse.json(
        { message: "대분류는 같은 유형(지역/테마 등)만 선택할 수 있습니다." },
        { status: 400 },
      );
    }
  }

  const duplicateName = await supabase
    .from("product_taxonomies")
    .select("id")
    .eq("taxonomy_type", taxonomy_type)
    .eq("name", name)
    .maybeSingle();
  if (duplicateName.error) {
    return NextResponse.json({ message: "중복 확인 중 오류가 발생했습니다." }, { status: 500 });
  }
  if (duplicateName.data) {
    return NextResponse.json({ message: "이미 등록된 항목입니다." }, { status: 409 });
  }

  if (slug != null) {
    const duplicateSlug = await supabase
      .from("product_taxonomies")
      .select("id")
      .eq("taxonomy_type", taxonomy_type)
      .eq("slug", slug)
      .maybeSingle();
    if (duplicateSlug.error) {
      return NextResponse.json({ message: "slug 중복 확인 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (duplicateSlug.data) {
      return NextResponse.json({ message: "동일 분류에 이미 사용 중인 slug입니다." }, { status: 409 });
    }
  }

  const insertPayload: Record<string, unknown> = {
    taxonomy_type,
    type,
    name,
    slug,
    is_active,
    sort_order,
    is_hub_visible,
    is_landing_enabled,
  };
  if (parent_id != null) insertPayload.parent_id = parent_id;
  if (type === "category" && category_type != null) {
    insertPayload.category_type = category_type;
  }
  if (body.card_image_url !== undefined) insertPayload.card_image_url = body.card_image_url?.trim() || null;
  if (body.card_title !== undefined) insertPayload.card_title = body.card_title?.trim() || null;
  if (body.card_description !== undefined) insertPayload.card_description = body.card_description?.trim() || null;
  if (body.landing_title !== undefined) insertPayload.landing_title = body.landing_title?.trim() || null;
  if (body.landing_description !== undefined) insertPayload.landing_description = body.landing_description?.trim() || null;
  if (body.hero_image_url !== undefined) insertPayload.hero_image_url = body.hero_image_url?.trim() || null;
  if (body.display_label !== undefined) insertPayload.display_label = body.display_label?.trim() || null;
  if (body.badge_priority !== undefined) {
    insertPayload.badge_priority =
      typeof body.badge_priority === "number" && Number.isFinite(body.badge_priority)
        ? body.badge_priority
        : null;
  }
  if (body.badge_visible !== undefined) insertPayload.badge_visible = Boolean(body.badge_visible);
  if (body.badge_tone !== undefined) insertPayload.badge_tone = body.badge_tone?.trim() || null;
  if (body.badge_description !== undefined) {
    insertPayload.badge_description = body.badge_description?.trim() || null;
  }

  const insertResult = await supabase
    .from("product_taxonomies")
    .insert(insertPayload)
    .select("id, taxonomy_type, type, name, slug")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ message: "항목 추가에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.TAXONOMY, REVALIDATE_MAX);
  revalidateTag(CACHE_TAGS.HEADER_NAV, REVALIDATE_MAX);
  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  return NextResponse.json(
    {
      message:
        taxonomy_type === "destination"
          ? "지역이 추가되었습니다."
          : taxonomy_type === "theme"
            ? "테마가 추가되었습니다."
            : "항목이 추가되었습니다.",
      item: insertResult.data,
    },
    { status: 201 },
  );
}
