import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { CACHE_TAGS, REVALIDATE_MAX } from "@/lib/cacheTags";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { parseThemeTokens } from "@/lib/productTaxonomies";
import type { ProductCategoryType, TaxonomyType } from "@/types/productTaxonomy";
import type { Product } from "@/types/product";

const TAXONOMY_TYPE_VALUES: TaxonomyType[] = ["destination", "theme", "product_line", "campaign", "tag"];

function isValidTaxonomyType(val: unknown): val is TaxonomyType {
  return typeof val === "string" && TAXONOMY_TYPE_VALUES.includes(val as TaxonomyType);
}

/** slug 검증: 영문 소문자, 숫자, 하이픈만 허용 */
function isUrlSafeSlug(s: string): boolean {
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s) || s === "";
}

type PatchBody = {
  taxonomy_type?: TaxonomyType;
  slug?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
  /** 상위 분류 id (대분류). null이면 최상위로 */
  parent_id?: string | null;
  /** @deprecated taxonomy_type 사용 */
  category_type?: ProductCategoryType | null;
  is_hub_visible?: boolean;
  is_landing_enabled?: boolean;
  /** 허브 카드 이미지 URL (지역/테마 카드용) */
  card_image_url?: string | null;
  card_title?: string | null;
  card_description?: string | null;
  /** 랜딩(히어로) 제목. 비우면 이름 사용 */
  landing_title?: string | null;
  /** 랜딩(히어로) 설명 */
  landing_description?: string | null;
  /** 랜딩(히어로) 배경 이미지 URL */
  hero_image_url?: string | null;
  display_label?: string | null;
  badge_priority?: number | null;
  badge_visible?: boolean;
  badge_tone?: string | null;
  badge_description?: string | null;
};

const BADGE_TONE_VALUES = new Set(["primary", "highlight", "neutral"]);

function normalizeBadgeTone(raw: string | null | undefined): string | null {
  if (raw == null || raw.trim() === "") return null;
  const s = raw.trim().toLowerCase();
  return BADGE_TONE_VALUES.has(s) ? s : null;
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  // 목록 API와 동일하게 anon 클라이언트로 조회(RLS 일치). 수정/삭제는 supabaseAdmin 사용.
  const taxonomyResult = await supabase
    .from("product_taxonomies")
    .select("id, type, taxonomy_type, name, slug")
    .eq("id", id)
    .maybeSingle();

  if (taxonomyResult.error) {
    console.error("[product-taxonomies PATCH] lookup error:", taxonomyResult.error);
    return NextResponse.json(
      { message: taxonomyResult.error.message || "항목 조회에 실패했습니다." },
      { status: 500 },
    );
  }
  if (!taxonomyResult.data) {
    return NextResponse.json({ message: "항목을 찾을 수 없습니다." }, { status: 404 });
  }

  const current = taxonomyResult.data as Record<string, unknown>;
  const currentTaxonomyType: TaxonomyType =
    current.taxonomy_type != null && String(current.taxonomy_type).trim() !== ""
      ? (current.taxonomy_type as TaxonomyType)
      : current.type === "theme"
        ? "theme"
        : "destination";

  const body = (await request.json()) as PatchBody;
  const updates: Record<string, unknown> = {};
  if (body.taxonomy_type !== undefined) {
    if (!isValidTaxonomyType(body.taxonomy_type)) {
      return NextResponse.json(
        { message: "유효한 taxonomy_type을 선택해 주세요. (destination, theme, product_line, campaign, tag)" },
        { status: 400 },
      );
    }
    updates.taxonomy_type = body.taxonomy_type;
    updates.type = body.taxonomy_type === "theme" ? "theme" : "category";
    if (updates.type === "category") {
      if (body.taxonomy_type === "destination") updates.category_type = "destination";
      else if (body.taxonomy_type === "product_line") updates.category_type = "product_line";
      else if (body.taxonomy_type === "campaign") updates.category_type = "highlight";
      else updates.category_type = null;
    } else {
      updates.category_type = null;
    }
  }
  if (body.slug !== undefined) {
    const v = body.slug?.trim() || null;
    if (v !== null && v !== "" && !isUrlSafeSlug(v)) {
      return NextResponse.json(
        { message: "slug는 영문 소문자, 숫자, 하이픈만 사용 가능합니다." },
        { status: 400 },
      );
    }
    updates.slug = v;
  }
  if (body.sort_order !== undefined) updates.sort_order = typeof body.sort_order === "number" ? body.sort_order : null;
  if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
  if (body.category_type !== undefined) updates.category_type = body.category_type ?? null;
  if (body.is_hub_visible !== undefined) updates.is_hub_visible = Boolean(body.is_hub_visible);
  if (body.is_landing_enabled !== undefined) updates.is_landing_enabled = Boolean(body.is_landing_enabled);
  if (body.parent_id !== undefined) {
    const nextParent =
      body.parent_id === null || body.parent_id === ""
        ? null
        : typeof body.parent_id === "string" && body.parent_id.trim() !== ""
          ? body.parent_id.trim()
          : null;
    if (nextParent === id) {
      return NextResponse.json({ message: "자기 자신을 대분류로 지정할 수 없습니다." }, { status: 400 });
    }
    if (nextParent != null) {
      const parentRow = await supabase
        .from("product_taxonomies")
        .select("id, taxonomy_type")
        .eq("id", nextParent)
        .maybeSingle();
      if (parentRow.error || !parentRow.data) {
        return NextResponse.json({ message: "선택한 대분류를 찾을 수 없습니다." }, { status: 400 });
      }
      const pt = (parentRow.data as { taxonomy_type?: string }).taxonomy_type;
      if (pt !== currentTaxonomyType) {
        return NextResponse.json(
          { message: "대분류는 같은 유형(지역/테마 등)만 선택할 수 있습니다." },
          { status: 400 },
        );
      }
    }
    updates.parent_id = nextParent;
  }
  if (body.card_image_url !== undefined) updates.card_image_url = body.card_image_url?.trim() || null;
  if (body.card_title !== undefined) updates.card_title = body.card_title?.trim() || null;
  if (body.card_description !== undefined) updates.card_description = body.card_description?.trim() || null;
  if (body.landing_title !== undefined) updates.landing_title = body.landing_title?.trim() || null;
  if (body.landing_description !== undefined) updates.landing_description = body.landing_description?.trim() || null;
  if (body.hero_image_url !== undefined) updates.hero_image_url = body.hero_image_url?.trim() || null;
  if (body.display_label !== undefined) updates.display_label = body.display_label?.trim() || null;
  if (body.badge_priority !== undefined) {
    updates.badge_priority =
      typeof body.badge_priority === "number" && Number.isFinite(body.badge_priority)
        ? body.badge_priority
        : null;
  }
  if (body.badge_visible !== undefined) updates.badge_visible = Boolean(body.badge_visible);
  // POST(create)와 검증 수준이 다름 — 2단계 고정만, 3단계에서 write path 정합화 예정 (`docs/products-funnel-stage2-policy-notes.md`).
  if (body.badge_tone !== undefined) {
    const t = normalizeBadgeTone(body.badge_tone ?? null);
    if (body.badge_tone != null && body.badge_tone.trim() !== "" && t === null) {
      return NextResponse.json(
        { message: "badge_tone은 primary, highlight, neutral 중 하나여야 합니다." },
        { status: 400 },
      );
    }
    updates.badge_tone = t;
  }
  if (body.badge_description !== undefined) updates.badge_description = body.badge_description?.trim() || null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "변경 사항이 없습니다." }, { status: 200 });
  }

  const slugToCheck = updates.slug !== undefined ? updates.slug : current.slug;
  const taxonomyTypeForSlug = (updates.taxonomy_type as TaxonomyType | undefined) ?? currentTaxonomyType;
  if (slugToCheck != null && String(slugToCheck).trim() !== "") {
    const duplicateSlug = await supabase
      .from("product_taxonomies")
      .select("id")
      .eq("taxonomy_type", taxonomyTypeForSlug)
      .eq("slug", slugToCheck)
      .neq("id", id)
      .maybeSingle();
    if (duplicateSlug.error) {
      return NextResponse.json({ message: "slug 중복 확인 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (duplicateSlug.data) {
      return NextResponse.json({ message: "동일 분류에 이미 사용 중인 slug입니다." }, { status: 409 });
    }
  }

  const updateResult = await supabaseAdmin
    .from("product_taxonomies")
    .update(updates)
    .eq("id", id)
    .select(
      "id, taxonomy_type, type, name, slug, is_active, sort_order, is_hub_visible, is_landing_enabled, category_type, parent_id, card_image_url, card_title, card_description, landing_title, landing_description, hero_image_url, display_label, badge_priority, badge_visible, badge_tone, badge_description",
    )
    .maybeSingle();

  if (updateResult.error) {
    return NextResponse.json(
      { message: updateResult.error.message || "수정에 실패했습니다." },
      { status: 500 },
    );
  }
  if (!updateResult.data) {
    return NextResponse.json({ message: "수정에 실패했습니다." }, { status: 500 });
  }

  revalidateTag(CACHE_TAGS.TAXONOMY, REVALIDATE_MAX);
  revalidateTag(CACHE_TAGS.HEADER_NAV, REVALIDATE_MAX);
  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  return NextResponse.json({ message: "수정되었습니다.", item: updateResult.data });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  // 목록 API와 동일하게 anon 클라이언트로 조회. 삭제는 supabaseAdmin 사용.
  const taxonomyResult = await supabase
    .from("product_taxonomies")
    .select("id, type, taxonomy_type, name")
    .eq("id", id)
    .maybeSingle();

  if (taxonomyResult.error) {
    console.error("[product-taxonomies DELETE] lookup error:", taxonomyResult.error);
    return NextResponse.json(
      { message: taxonomyResult.error.message || "항목 조회에 실패했습니다." },
      { status: 500 },
    );
  }
  if (!taxonomyResult.data) {
    return NextResponse.json({ message: "삭제할 항목을 찾을 수 없습니다." }, { status: 404 });
  }

  const row = taxonomyResult.data as Record<string, unknown>;
  const taxonomyType: TaxonomyType =
    row.taxonomy_type != null && String(row.taxonomy_type).trim() !== ""
      ? (row.taxonomy_type as TaxonomyType)
      : row.type === "theme"
        ? "theme"
        : "destination";
  const name = String(taxonomyResult.data.name ?? "");
  const productsResult = await supabase.from("products").select("category,theme");
  if (productsResult.error) {
    return NextResponse.json({ message: "상품 목록 조회에 실패했습니다." }, { status: 500 });
  }
  const products = (productsResult.data ?? []) as Product[];

  const inUseCount =
    taxonomyType === "theme"
      ? products.filter((product) => parseThemeTokens(product.theme).includes(name)).length
      : products.filter((product) => product.category === name).length;

  if (inUseCount > 0) {
    return NextResponse.json(
      {
        message: `현재 ${inUseCount}개 상품에서 사용 중이라 삭제할 수 없습니다. 사용 중인 상품의 카테고리 설정에서 먼저 해제한 뒤 삭제해 주세요.`,
        code: "TAXONOMY_IN_USE",
        inUseCount,
      },
      { status: 409 },
    );
  }

  const deleteResult = await supabaseAdmin
    .from("product_taxonomies")
    .delete()
    .eq("id", id);

  if (deleteResult.error) {
    return NextResponse.json(
      { message: deleteResult.error.message || "항목 삭제에 실패했습니다." },
      { status: 500 },
    );
  }

  revalidateTag(CACHE_TAGS.TAXONOMY, REVALIDATE_MAX);
  revalidateTag(CACHE_TAGS.HEADER_NAV, REVALIDATE_MAX);
  revalidateTag(CACHE_TAGS.PRODUCTS, REVALIDATE_MAX);
  return NextResponse.json({ message: "삭제되었습니다." });
}
