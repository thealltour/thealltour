import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;
  const { id } = await context.params;

  const { data: row, error } = await supabase
    .from("point_earn_requests")
    .select(`
      id,
      user_id,
      status,
      booking_ref,
      departure_date,
      payer_name,
      memo,
      contact_phone,
      admin_memo,
      reject_reason,
      requested_at,
      decided_at,
      members ( id, name, username, email, phone )
    `)
    .eq("id", id)
    .maybeSingle();

  if (error || !row) {
    return NextResponse.json({ message: "요청을 찾을 수 없습니다." }, { status: 404 });
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
