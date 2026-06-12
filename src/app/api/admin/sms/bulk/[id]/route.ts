import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id } = await context.params;

  const [jobRes, itemsRes] = await Promise.all([
    supabaseAdmin.from("sms_bulk_jobs").select("*").eq("id", id).maybeSingle(),
    supabaseAdmin
      .from("sms_bulk_job_items")
      .select("id, recipient_phone, recipient_name, status, failure_reason, processed_at")
      .eq("job_id", id)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  if (jobRes.error || !jobRes.data) {
    return NextResponse.json({ message: "작업을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    job: jobRes.data,
    items: itemsRes.data ?? [],
  });
}
