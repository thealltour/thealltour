import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { RewardRedemptionRow } from "@/types/pointsRewards";

/** 관리자: 경품 교환 신청 목록 (status 필터 가능) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  let query = supabase
    .from("reward_redemption")
    .select("*, reward_catalog:reward_catalog_id(id,title,point_price,image_url), members(id,name,username,email,phone)")
    .order("created_at", { ascending: false });

  if (status?.trim()) {
    query = query.eq("status", status.trim());
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: "교환 목록을 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as (RewardRedemptionRow & { reward_catalog?: { id: string; title: string; point_price: number; image_url: string | null }; members?: { id: string; name: string; username: string; email: string; phone: string } })[]);
}
