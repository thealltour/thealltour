import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

/** 관리자: 교환 거절 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id: redemptionId } = await context.params;
  const body = (await request.json()).catch(() => ({})) as { admin_note?: string };
  const adminNote = body.admin_note?.trim() ?? null;

  const { data: row } = await supabase
    .from("reward_redemption")
    .select("id,status")
    .eq("id", redemptionId)
    .maybeSingle();

  if (!row) {
    return NextResponse.json({ message: "해당 교환 신청을 찾을 수 없습니다." }, { status: 404 });
  }

  if ((row as { status: string }).status !== "requested") {
    return NextResponse.json({ message: "이미 처리된 신청입니다." }, { status: 400 });
  }

  const { error } = await supabase
    .from("reward_redemption")
    .update({
      status: "rejected",
      admin_note: adminNote,
      processed_at: new Date().toISOString(),
    })
    .eq("id", redemptionId);

  if (error) {
    return NextResponse.json({ message: "거절 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "거절되었습니다." });
}
