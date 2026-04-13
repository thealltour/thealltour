import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabase } from "@/lib/supabase";
import { appendInquiryActivityLog, normalizeActivityLogRow } from "@/lib/inquiries/inquiryActivityLog";
import type { InquiryActivityType } from "@/types/inquiry";

const CLIENT_ACTIVITY_TYPES: InquiryActivityType[] = ["template_copied", "manual_log"];

const DEFAULT_ACTOR = "관리자";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inquiryId } = await context.params;
  const limit = 50;

  const { data, error } = await supabase
    .from("inquiry_activity_logs")
    .select("*")
    .eq("inquiry_id", inquiryId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ message: "활동 로그를 불러오지 못했습니다." }, { status: 500 });
  }

  const logs = (data ?? []).map((row) => normalizeActivityLogRow(row as Record<string, unknown>));
  return NextResponse.json({ logs });
}

type PostBody = {
  activity_type?: InquiryActivityType;
  summary?: string;
  metadata?: Record<string, unknown> | null;
  actor_name?: string | null;
};

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inquiryId } = await context.params;
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ message: "JSON 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const type = body.activity_type;
  if (!type || !CLIENT_ACTIVITY_TYPES.includes(type)) {
    return NextResponse.json({ message: "허용되지 않은 activity_type입니다." }, { status: 400 });
  }
  const summary = typeof body.summary === "string" ? body.summary.trim() : "";
  if (!summary) {
    return NextResponse.json({ message: "summary는 필수입니다." }, { status: 400 });
  }

  const actorName =
    typeof body.actor_name === "string" && body.actor_name.trim() ? body.actor_name.trim() : DEFAULT_ACTOR;

  const { error: logErr } = await appendInquiryActivityLog(supabase, {
    inquiry_id: inquiryId,
    activity_type: type,
    actor_name: actorName,
    summary,
    metadata: body.metadata ?? null,
  });
  if (logErr) {
    return NextResponse.json({ message: "활동 로그 저장에 실패했습니다." }, { status: 500 });
  }

  await supabase.from("inquiries").update({ last_activity_at: new Date().toISOString() }).eq("id", inquiryId);

  return NextResponse.json({ ok: true });
}
