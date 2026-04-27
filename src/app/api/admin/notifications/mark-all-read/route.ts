import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH() {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const result = await supabaseAdmin
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("is_read", false)
    .select("id");

  if (result.error) {
    return NextResponse.json({ message: "알림 전체 읽음 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "전체 읽음 처리되었습니다." });
}
