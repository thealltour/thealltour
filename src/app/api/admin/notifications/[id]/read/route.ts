import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;
  if (!id) {
    return NextResponse.json({ message: "알림 ID가 올바르지 않습니다." }, { status: 400 });
  }

  const result = await supabaseAdmin
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (result.error) {
    return NextResponse.json({ message: "알림 읽음 처리에 실패했습니다." }, { status: 500 });
  }
  if (!result.data) {
    return NextResponse.json({ message: "대상 알림을 찾지 못했습니다." }, { status: 404 });
  }

  return NextResponse.json({ message: "읽음 처리되었습니다." });
}
