import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { supabase } from "@/lib/supabase";

const FEATURED_PRODUCT_LIMIT = 8;

type ProductBody = {
  title?: string;
  description?: string;
  product_source_url?: string | null;
  point_benefits?: string | null;
  point_tourism?: string | null;
  point_guide?: string | null;
  meeting_info?: string | null;
  travel_insurance?: string | null;
  included_items?: string | null;
  excluded_items?: string | null;
  detailed_schedule?: string | null;
  optional_tours?: string | null;
  terms_and_notes?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  image_url?: string;
  category?: string;
  theme?: string | null;
  price?: number | null;
  duration?: string | null;
  itinerary?: string | null;
  inclusions?: string | null;
  is_active?: boolean;
  is_featured_home?: boolean;
  sort_order?: number | null;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const body = (await request.json()) as ProductBody;

  if (body.is_featured_home === true) {
    const existingQuery = await supabase
      .from("products")
      .select("id,is_featured_home")
      .eq("id", id)
      .maybeSingle();

    if (existingQuery.error || !existingQuery.data) {
      return NextResponse.json({ message: "상품을 찾을 수 없습니다." }, { status: 404 });
    }

    const alreadyFeatured = Boolean(existingQuery.data.is_featured_home);
    if (!alreadyFeatured) {
      const featuredCountQuery = await supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("is_featured_home", true);

      if (featuredCountQuery.error) {
        return NextResponse.json({ message: "추천상품 개수 확인에 실패했습니다." }, { status: 500 });
      }
      if ((featuredCountQuery.count ?? 0) >= FEATURED_PRODUCT_LIMIT) {
        return NextResponse.json(
          { message: `메인 추천상품은 최대 ${FEATURED_PRODUCT_LIMIT}개까지 설정할 수 있습니다.` },
          { status: 400 },
        );
      }
    }
  }

  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = body.title?.trim();
  if (body.description !== undefined) updates.description = body.description?.trim();
  if (body.meta_title !== undefined) updates.meta_title = body.meta_title?.trim() || null;
  if (body.meta_description !== undefined) updates.meta_description = body.meta_description?.trim() || null;
  if (body.point_benefits !== undefined) updates.point_benefits = body.point_benefits?.trim() || null;
  if (body.point_tourism !== undefined) updates.point_tourism = body.point_tourism?.trim() || null;
  if (body.point_guide !== undefined) updates.point_guide = body.point_guide?.trim() || null;
  if (body.meeting_info !== undefined) updates.meeting_info = body.meeting_info?.trim() || null;
  if (body.travel_insurance !== undefined) updates.travel_insurance = body.travel_insurance?.trim() || null;
  if (body.included_items !== undefined) updates.included_items = body.included_items?.trim() || null;
  if (body.excluded_items !== undefined) updates.excluded_items = body.excluded_items?.trim() || null;
  if (body.detailed_schedule !== undefined) updates.detailed_schedule = body.detailed_schedule?.trim() || null;
  if (body.optional_tours !== undefined) updates.optional_tours = body.optional_tours?.trim() || null;
  if (body.terms_and_notes !== undefined) updates.terms_and_notes = body.terms_and_notes?.trim() || null;
  if (body.product_source_url !== undefined) updates.product_source_url = body.product_source_url?.trim() || null;
  if (body.image_url !== undefined) updates.image_url = body.image_url?.trim();
  if (body.category !== undefined) updates.category = body.category?.trim();
  if (body.theme !== undefined) updates.theme = body.theme?.trim() || null;
  if (body.duration !== undefined) updates.duration = body.duration?.trim() || null;
  if (body.itinerary !== undefined) updates.itinerary = body.itinerary?.trim() || null;
  if (body.inclusions !== undefined) updates.inclusions = body.inclusions?.trim() || null;
  if (body.price !== undefined) updates.price = typeof body.price === "number" ? body.price : null;
  if (body.is_active !== undefined) updates.is_active = body.is_active;
  if (body.is_featured_home !== undefined) {
    updates.is_featured_home = body.is_featured_home;
    if (body.is_featured_home) {
      // 추천상품으로 설정되면 자동으로 활성화합니다.
      updates.is_active = true;
    }
  }
  if (body.sort_order !== undefined) {
    updates.sort_order = typeof body.sort_order === "number" ? body.sort_order : null;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const updateResult = await supabase
    .from("products")
    .update(updates)
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (updateResult.error) {
    return NextResponse.json({ message: "상품 수정에 실패했습니다." }, { status: 500 });
  }
  if (!updateResult.data) {
    return NextResponse.json(
      { message: "상품 수정 권한이 없거나 대상 상품을 찾지 못했습니다. (RLS 정책 확인 필요)" },
      { status: 403 },
    );
  }

  revalidateTag("products", "max");
  return NextResponse.json({ message: "상품이 수정되었습니다." });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const deleteResult = await supabase.from("products").delete().eq("id", id).select("id").maybeSingle();

  if (deleteResult.error) {
    return NextResponse.json({ message: "상품 삭제에 실패했습니다." }, { status: 500 });
  }
  if (!deleteResult.data) {
    return NextResponse.json(
      { message: "상품 삭제 권한이 없거나 대상 상품을 찾지 못했습니다. (RLS 정책 확인 필요)" },
      { status: 403 },
    );
  }

  revalidateTag("products", "max");
  return NextResponse.json({ message: "상품이 삭제되었습니다." });
}
