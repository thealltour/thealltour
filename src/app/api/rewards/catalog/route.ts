import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/** 활성 경품 목록, sort_order 순. 공개 API. */
export async function GET() {
  const { data, error } = await supabase
    .from("reward_catalog")
    .select("id, title, description, point_cost, stock, image_url, is_active, sort_order, created_at")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ message: "목록을 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
