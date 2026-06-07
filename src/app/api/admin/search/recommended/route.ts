import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type RecommendedKeywordRow = {
  id: string;
  keyword: string;
  sort_order: number | null;
  is_active: boolean | null;
};

export async function GET() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { data, error } = await supabaseAdmin
    .from("recommended_search_keywords")
    .select("id, keyword, sort_order, is_active")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load recommended_search_keywords (admin)", error);
    return NextResponse.json(
      { message: "추천 검색어를 불러오는 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }

  const items =
    data?.map((row) => ({
      id: row.id,
      keyword: row.keyword,
      sortOrder: row.sort_order ?? 0,
      isActive: row.is_active ?? false,
    })) ?? [];

  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const body = (await request.json()) as {
    keyword?: string;
    sortOrder?: number;
    isActive?: boolean;
  };

  const keyword = (body.keyword ?? "").trim();
  if (!keyword) {
    return NextResponse.json({ message: "keyword는 필수입니다." }, { status: 400 });
  }

  const sortOrder =
    typeof body.sortOrder === "number" && Number.isFinite(body.sortOrder)
      ? body.sortOrder
      : 0;
  const isActive = body.isActive ?? true;

  const { data, error } = await supabaseAdmin
    .from("recommended_search_keywords")
    .insert({
      keyword,
      sort_order: sortOrder,
      is_active: isActive,
    })
    .select("id, keyword, sort_order, is_active")
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to create recommended_search_keyword (admin)", error);
    return NextResponse.json(
      { message: "추천 검색어 생성에 실패했습니다." },
      { status: 500 },
    );
  }

  return NextResponse.json(
    {
      item: {
        id: data.id,
        keyword: data.keyword,
        sortOrder: data.sort_order ?? 0,
        isActive: data.is_active ?? false,
      },
    },
    { status: 201 },
  );
}
