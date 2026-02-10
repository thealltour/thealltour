import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function PATCH() {
  const result = await supabase
    .from("admin_notifications")
    .update({ is_read: true })
    .eq("is_read", false)
    .select("id");

  if (result.error) {
    return NextResponse.json({ message: "알림 전체 읽음 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ message: "전체 읽음 처리되었습니다." });
}
