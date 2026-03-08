import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { RewardCatalogRow } from "@/types/pointsRewardsV2";

/** 관리자: 경품 목록 (비활성 포함) */
export async function GET() {
  const { data, error } = await supabase
    .from("reward_catalog")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: "경품 목록을 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as RewardCatalogRow[]);
}

type CatalogBody = {
  title?: string;
  description?: string;
  point_price?: number;
  image_url?: string | null;
  stock_count?: number;
  is_active?: boolean;
  sort_order?: number;
};

/** 관리자: 경품 추가 */
export async function POST(request: Request) {
  const body = (await request.json()) as CatalogBody;
  const title = body.title?.trim();
  if (!title) {
    return NextResponse.json({ message: "제목을 입력해 주세요." }, { status: 400 });
  }
  const pointPrice = Number(body.point_price);
  if (!Number.isFinite(pointPrice) || pointPrice <= 0) {
    return NextResponse.json({ message: "포인트 가격은 1 이상의 숫자로 입력해 주세요." }, { status: 400 });
  }

  const row = {
    title,
    description: body.description?.trim() || null,
    point_price: pointPrice,
    image_url: body.image_url?.trim() || null,
    stock_count: Math.max(0, Math.floor(Number(body.stock_count) || 0)),
    is_active: body.is_active !== false,
    sort_order: Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("reward_catalog").insert(row).select("id,title,point_price").maybeSingle();
  if (error) {
    return NextResponse.json({ message: "경품 등록에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "등록되었습니다.", id: (data as { id: string })?.id }, { status: 201 });
}
