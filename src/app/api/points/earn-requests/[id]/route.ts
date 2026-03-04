import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireMemberSession } from "@/lib/apiAuth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireMemberSession();
  if (auth.res) return auth.res;
  const userId = auth.session.memberId;
  const { id } = await context.params;

  const { data: row, error } = await supabase
    .from("point_earn_requests")
    .select("id, user_id, status, booking_ref, departure_date, payer_name, memo, contact_phone, admin_memo, reject_reason, requested_at, decided_at")
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ message: "요청을 찾을 수 없습니다." }, { status: 404 });
  }
  if ((row as { user_id: string }).user_id !== userId) {
    return NextResponse.json({ message: "권한이 없습니다." }, { status: 403 });
  }

  const { data: attachments } = await supabase
    .from("earn_request_attachments")
    .select("id, file_url, file_name, mime_type, file_size, created_at")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  return NextResponse.json({
    ...(row as Record<string, unknown>),
    attachments: attachments ?? [],
  });
}
