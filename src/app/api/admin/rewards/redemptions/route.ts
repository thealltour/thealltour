import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

/** 관리자: 교환 신청 목록 (query status=REQUESTED 등) */
export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim() || undefined;

  let query = supabase
    .from("reward_redemptions")
    .select(`
      *,
      reward_catalog ( id, title, point_cost, stock ),
      members ( id, name, username, email, phone )
    `)
    .order("created_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: "목록을 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
