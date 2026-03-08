import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { RewardCatalogRow } from "@/types/pointsRewardsV2";

/** 교환 가능 경품 목록 (비로그인도 조회 가능) */
export async function GET() {
  const { data, error } = await supabase
    .from("reward_catalog")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ message: "경품 목록을 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json((data ?? []) as RewardCatalogRow[]);
}
