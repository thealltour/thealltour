import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requireMemberSession } from "@/lib/apiAuth";

const PAGE_SIZE = 50;

/** 내 알림 목록 (REWARD_STATUS, POINT_EARNED, ADMIN_MESSAGE) */
export async function GET(request: Request) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const userId = auth.session.memberId;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || PAGE_SIZE));
  const unreadOnly = searchParams.get("unreadOnly") === "true";

  let query = supabaseAdmin
    .from("notifications")
    .select("id, type, title, body, is_read, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.eq("is_read", false);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ message: "알림을 불러올 수 없습니다." }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
