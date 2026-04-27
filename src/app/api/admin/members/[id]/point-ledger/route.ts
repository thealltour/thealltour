import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const LIMIT = 100;

/** 관리자: 특정 회원의 포인트 원장(지급/사용 등) 목록 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: userId } = await context.params;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, Number(searchParams.get("limit")) || LIMIT));

  const { data, error } = await supabaseAdmin
    .from("point_ledger")
    .select("id, type, status, amount, reason, ref_type, ref_id, expires_at, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ message: "포인트 내역을 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
