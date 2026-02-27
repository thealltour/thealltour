import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

type RecommendedKeywordRow = {
  id: string;
  keyword: string;
  sort_order: number | null;
  is_active: boolean | null;
};

export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ message: "id가 필요합니다." }, { status: 400 });
  }

  const body = (await request.json()) as {
    keyword?: string;
    sortOrder?: number;
    isActive?: boolean;
  };

  const update: Partial<RecommendedKeywordRow> = {};

  if (typeof body.keyword === "string") {
    update.keyword = body.keyword.trim();
  }
  if (typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)) {
    update.sort_order = body.sortOrder;
  }
  if (typeof body.isActive === "boolean") {
    update.is_active = body.isActive;
  }

  const { data, error } = await supabase
    .from<RecommendedKeywordRow>("recommended_search_keywords")
    .update({
      ...update,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id, keyword, sort_order, is_active")
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to update recommended_search_keyword", error);
    return NextResponse.json(
      { message: "추천 검색어 수정에 실패했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    item: {
      id: data.id,
      keyword: data.keyword,
      sortOrder: data.sort_order ?? 0,
      isActive: data.is_active ?? false,
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ message: "id가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabase
    .from("recommended_search_keywords")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Failed to delete recommended_search_keyword", error);
    return NextResponse.json(
      { message: "추천 검색어 삭제에 실패했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "삭제되었습니다." });
}

