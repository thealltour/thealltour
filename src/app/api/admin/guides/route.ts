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

  if (notionUrl && !notionPageId) {
    return NextResponse.json({ message: "노션 URL에서 페이지 ID를 추출할 수 없습니다." }, { status: 400 });
  }
  if (!title && !notionPageId) {
    return NextResponse.json({ message: "제목을 입력해 주세요." }, { status: 400 });
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
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ message: "여행가이드 등록에 실패했습니다." }, { status: 500 });
  }

  if (data?.id && notionPageId) {
    await syncGuideFromNotion(data.id);
  }

  return NextResponse.json(data, { status: 201 });
}

