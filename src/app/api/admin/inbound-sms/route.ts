import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { mapInboundSmsRow } from "@/lib/sms/inboundSmsRepository";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(request: Request) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const url = new URL(request.url);
  const status = url.searchParams.get("status")?.trim() ?? "unmatched";
  const pageRaw = Number.parseInt(url.searchParams.get("page") ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const pageSize = 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabaseAdmin
    .from("inquiry_inbound_sms")
    .select(
      "id, provider, provider_message_id, sender_phone, message, received_at, inquiry_id, match_status, match_reason, read_at, created_at",
      { count: "exact" },
    )
    .order("received_at", { ascending: false });

  if (status === "unmatched") {
    query = query.eq("match_status", "unmatched");
  }

  const { data, error, count } = await query.range(from, to);

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ items: [], total: 0, page, pageSize });
    }
    return NextResponse.json({ message: "수신 SMS 목록 조회에 실패했습니다." }, { status: 500 });
  }

  const items = (data ?? []).map((row) => mapInboundSmsRow(row as Record<string, unknown>));
  return NextResponse.json({ items, total: count ?? 0, page, pageSize });
}
