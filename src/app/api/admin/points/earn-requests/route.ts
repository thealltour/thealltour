import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { requireAdminSession } from "@/lib/apiAuth";

export async function GET(request: NextRequest) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status")?.trim();

  let query = supabase
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
    .order("requested_at", { ascending: false });

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ message: "요청 목록을 불러오지 못했습니다." }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}
