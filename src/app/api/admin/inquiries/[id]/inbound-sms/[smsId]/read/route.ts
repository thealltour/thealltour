import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function PATCH(
  _request: Request,
  context: { params: Promise<{ id: string; smsId: string }> },
) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inquiryId, smsId } = await context.params;
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from("inquiry_inbound_sms")
    .update({ read_at: nowIso })
    .eq("id", smsId)
    .eq("inquiry_id", inquiryId)
    .is("read_at", null)
    .select("id, read_at")
    .maybeSingle();

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ message: "수신 SMS 테이블이 없습니다." }, { status: 500 });
    }
    return NextResponse.json({ message: "열람 처리에 실패했습니다." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data?.id ?? smsId, read_at: data?.read_at ?? nowIso });
}
