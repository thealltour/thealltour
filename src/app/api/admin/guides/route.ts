import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Guide } from "@/types/guide";

type GuideBody = Partial<
  Pick<Guide, "title" | "summary" | "thumbnail_url" | "landing_url" | "is_published" | "sort_order">
>;

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
  const sortOrder = typeof body.sort_order === "number" ? body.sort_order : null;
  const isPublished = body.is_published ?? true;

  if (!title) {
    return NextResponse.json({ message: "제목을 입력해 주세요." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("guides")
    .insert({
      title,
      summary: summary || null,
      thumbnail_url: thumbnailUrl || null,
      landing_url: landingUrl || null,
      is_published: isPublished,
      sort_order: sortOrder,
    })
    .select("*")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ message: "여행가이드 등록에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}

