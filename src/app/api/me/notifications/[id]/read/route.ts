import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireMemberSession } from "@/lib/apiAuth";

/** 회원: 알림 읽음 처리 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const userId = auth.session.memberId;
  const { id } = await context.params;

  if (!id) {
    return NextResponse.json({ message: "알림 ID가 필요합니다." }, { status: 400 });
  }

  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id)
    .eq("user_id", userId);

  if (error) {
    return NextResponse.json({ message: "읽음 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
