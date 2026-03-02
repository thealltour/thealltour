import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Guide } from "@/types/guide";
import { extractNotionPageId } from "@/lib/notion";
import { syncGuideFromNotion } from "@/lib/notionSync";

type GuideBody = Partial<
  Pick<
    Guide,
    | "title"
    | "summary"
    | "thumbnail_url"
    | "landing_url"
    | "guide_pdf_url"
    | "guide_thumbnail_url"
    | "is_published"
    | "sort_order"
    | "slug"
    | "notion_url"
    | "notion_page_id"
    | "title_override"
    | "cover_image_url"
    | "tags"
    | "category"
    | "published_at"
  >
>;

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "가이드 ID가 올바르지 않습니다." }, { status: 400 });
  }

  const body = (await request.json()) as GuideBody;
  const updates: Record<string, unknown> = {};

  if (body.title !== undefined) updates.title = body.title.trim();
  if (body.summary !== undefined) updates.summary = body.summary.trim();
  if (body.thumbnail_url !== undefined) updates.thumbnail_url = body.thumbnail_url.trim();
  if (body.landing_url !== undefined) updates.landing_url = body.landing_url.trim();
  if (body.guide_pdf_url !== undefined) updates.guide_pdf_url = (body.guide_pdf_url ?? "").trim() || null;
  if (body.guide_thumbnail_url !== undefined)
    updates.guide_thumbnail_url = (body.guide_thumbnail_url ?? "").trim() || null;
  if (body.is_published !== undefined) updates.is_published = body.is_published;
  if (body.sort_order !== undefined) updates.sort_order = body.sort_order;
  if (body.slug !== undefined) updates.slug = (body.slug ?? "").trim() || null;
  if (body.notion_url !== undefined) {
    const notionUrl = (body.notion_url ?? "").trim();
    updates.notion_url = notionUrl || null;
    if (notionUrl) {
      const pageId = extractNotionPageId(notionUrl);
      if (!pageId) {
        return NextResponse.json({ message: "노션 URL에서 페이지 ID를 추출할 수 없습니다." }, { status: 400 });
      }
      updates.notion_page_id = pageId;
    }
  }
  if (body.notion_page_id !== undefined) updates.notion_page_id = (body.notion_page_id ?? "").trim() || null;
  if (body.title_override !== undefined) updates.title_override = (body.title_override ?? "").trim() || null;
  if (body.cover_image_url !== undefined) updates.cover_image_url = (body.cover_image_url ?? "").trim() || null;
  if (body.tags !== undefined) {
    updates.tags = Array.isArray(body.tags)
      ? body.tags.map((t) => String(t).trim()).filter((t) => t.length > 0)
      : null;
  }
  if (body.category !== undefined) updates.category = (body.category ?? "").trim() || null;
  if (body.published_at !== undefined) updates.published_at = body.published_at || null;

  if (!Object.keys(updates).length) {
    return NextResponse.json({ message: "수정할 항목이 없습니다." }, { status: 400 });
  }

  const { data, error } = await supabase.from("guides").update(updates).eq("id", id).select("*").maybeSingle();
  if (error) {
    return NextResponse.json({ message: "여행가이드 수정에 실패했습니다." }, { status: 500 });
  }

  if (data?.notion_page_id) {
    await syncGuideFromNotion(id);
  }

  return NextResponse.json({ message: "여행가이드가 수정되었습니다." });
}

export async function DELETE(_: Request, context: RouteContext) {
  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "가이드 ID가 올바르지 않습니다." }, { status: 400 });
  }

  const { error } = await supabase.from("guides").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ message: "여행가이드 삭제에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "여행가이드가 삭제되었습니다." });
}

