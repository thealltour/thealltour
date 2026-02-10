import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { Notice } from "@/types/notice";

type NoticeBody = {
  title?: string;
  content?: string;
  is_published?: boolean;
  sort_order?: number | null;
};

function mapNotice(row: Record<string, unknown>): Notice {
  return {
    id: String(row.id ?? ""),
    title: String(row.title ?? ""),
    content: String(row.content ?? ""),
    is_published: typeof row.is_published === "boolean" ? row.is_published : true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : null,
    created_at: typeof row.created_at === "string" ? row.created_at : null,
    updated_at: typeof row.updated_at === "string" ? row.updated_at : null,
  };
}

export async function GET() {
  const result = await supabase
    .from("notices")
    .select("*")
    .order("sort_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (result.error) {
    return NextResponse.json({ message: "공지 목록 조회에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json((result.data ?? []).map((row) => mapNotice(row as Record<string, unknown>)));
}

export async function POST(request: Request) {
  const body = (await request.json()) as NoticeBody;
  const title = body.title?.trim() ?? "";
  const content = body.content?.trim() ?? "";
  if (!title || !content) {
    return NextResponse.json({ message: "제목과 내용은 필수입니다." }, { status: 400 });
  }

  const insertResult = await supabase
    .from("notices")
    .insert({
      title,
      content,
      is_published: body.is_published ?? true,
      sort_order: typeof body.sort_order === "number" ? body.sort_order : null,
    })
    .select("id")
    .maybeSingle();

  if (insertResult.error || !insertResult.data) {
    return NextResponse.json({ message: "공지 등록에 실패했습니다." }, { status: 500 });
  }
  return NextResponse.json({ message: "공지가 등록되었습니다." }, { status: 201 });
}
