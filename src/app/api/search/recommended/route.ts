import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/** 공개용: 활성 추천 검색어만 조회. 관리 CRUD는 /api/admin/search/recommended 사용. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  if (includeInactive) {
    return NextResponse.json({ message: "관리자 인증이 필요합니다." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("recommended_search_keywords")
    .select("id, keyword, sort_order, is_active")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load recommended_search_keywords", error);
    return NextResponse.json(
      { message: "추천 검색어를 불러오는 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }

  const items =
    data?.map((row) => ({
      id: row.id,
      keyword: row.keyword,
    })) ?? [];

  return NextResponse.json({
    items: items.slice(0, 10),
  });
}
