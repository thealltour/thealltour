import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Guide } from "@/types/guide";
import { extractNotionPageId, validateNotionPageAccess } from "@/lib/notion";
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
    | "seo_title"
    | "seo_description"
    | "focus_keyword"
  >
>;

function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function ensureUniqueSlug(base: string): Promise<string> {
  const seed = slugify(base) || `guide-${Date.now()}`;
  let slug = seed;
  let index = 1;
  // 간단한 unique 보장 루프
  while (true) {
    const { data } = await supabase.from("guides").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
    index += 1;
    slug = `${seed}-${index}`;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return "알 수 없는 오류";
}

export async function GET() {
  const { data, error } = await supabase
    .from("guides")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    return NextResponse.json({ message: "여행가이드 목록 조회에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}

export async function POST(request: Request) {
  const body = (await request.json()) as GuideBody;
  const title = body.title?.trim() ?? "";
  const summary = body.summary?.trim() ?? "";
  const thumbnailUrl = body.thumbnail_url?.trim() ?? "";
  const landingUrl = body.landing_url?.trim() ?? "";
  const guidePdfUrl = body.guide_pdf_url?.trim() ?? "";
  const guideThumbnailUrl = body.guide_thumbnail_url?.trim() ?? "";
  const sortOrder = typeof body.sort_order === "number" ? body.sort_order : null;
  const isPublished = body.is_published ?? true;
  const notionUrl = body.notion_url?.trim() ?? "";
  const parsedNotionPageId = notionUrl ? extractNotionPageId(notionUrl) : null;
  const notionPageId = body.notion_page_id?.trim() || parsedNotionPageId || null;
  const slug = await ensureUniqueSlug(body.slug?.trim() || title);
  const titleOverride = body.title_override?.trim() || null;
  const coverImageUrl = body.cover_image_url?.trim() || null;
  const tags = Array.isArray(body.tags)
    ? body.tags.map((t) => String(t).trim()).filter((t) => t.length > 0)
    : null;
  const category = body.category?.trim() || null;
  const publishedAt = body.published_at?.trim() || null;
  const seoTitle = body.seo_title?.trim() || null;
  const seoDescription = body.seo_description?.trim() || null;
  const focusKeyword = body.focus_keyword?.trim() || null;

  if (notionUrl && !notionPageId) {
    return NextResponse.json({ message: "노션 URL에서 페이지 ID를 추출할 수 없습니다." }, { status: 400 });
  }
  if (!title && !notionPageId) {
    return NextResponse.json({ message: "제목을 입력해 주세요." }, { status: 400 });
  }
  if (notionPageId) {
    const validation = await validateNotionPageAccess(notionPageId);
    if (!validation.ok) {
      return NextResponse.json({ message: validation.message }, { status: 400 });
    }
  }
  const titleForInsert = title || "노션 여행가이드";

  const { data, error } = await supabase
    .from("guides")
    .insert({
      title: titleForInsert,
      summary: summary || null,
      thumbnail_url: thumbnailUrl || null,
      landing_url: landingUrl || null,
      guide_pdf_url: guidePdfUrl || null,
      guide_thumbnail_url: guideThumbnailUrl || null,
      is_published: isPublished,
      sort_order: sortOrder,
      slug,
      notion_url: notionUrl || null,
      notion_page_id: notionPageId,
      title_override: titleOverride,
      cover_image_url: coverImageUrl,
      tags,
      category,
      published_at: publishedAt,
      seo_title: seoTitle,
      seo_description: seoDescription,
      focus_keyword: focusKeyword,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    console.error("[api/admin/guides:POST] insert failed", error);
    const reason = error?.message ? ` (${error.message})` : "";
    return NextResponse.json({ message: `여행가이드 등록에 실패했습니다.${reason}` }, { status: 500 });
  }

  if (data?.id && notionPageId) {
    try {
      await syncGuideFromNotion(data.id);
    } catch (error) {
      const reason = getErrorMessage(error);
      return NextResponse.json(
        {
          ...data,
          message: `가이드는 등록되었지만 노션 동기화에 실패했습니다. (${reason})`,
        },
        { status: 201 },
      );
    }
  }

  return NextResponse.json(data, { status: 201 });
}

