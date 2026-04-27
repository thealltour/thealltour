import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeInquiryRow } from "@/lib/inquiries/normalizeInquiryRow";
import { appendInquiryActivityLog } from "@/lib/inquiries/inquiryActivityLog";
import { INQUIRY_RESPONSE_STAGES, type InquiryResponseStage } from "@/types/inquiry";

type PatchBody = {
  response_checklist?: Record<string, boolean>;
  response_note?: string;
  response_stage?: InquiryResponseStage;
};

function parseChecklist(raw: unknown): Record<string, boolean> | null {
  if (raw === undefined) return null;
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v !== "boolean") return null;
    out[k] = v;
  }
  return out;
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireAdminSession();
  if (!auth.ok) return auth.res;

  const { id: inquiryId } = await context.params;
  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ message: "JSON 본문이 올바르지 않습니다." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};

  if (body.response_checklist !== undefined) {
    const parsed = parseChecklist(body.response_checklist);
    if (parsed === null) {
      return NextResponse.json(
        { message: "response_checklist는 boolean 값만 가진 객체여야 합니다." },
        { status: 400 },
      );
    }
    updates.response_checklist = parsed;
  }

  if (body.response_note !== undefined) {
    if (typeof body.response_note !== "string") {
      return NextResponse.json({ message: "response_note는 문자열이어야 합니다." }, { status: 400 });
    }
    updates.response_note = body.response_note;
  }

  if (body.response_stage !== undefined) {
    if (body.response_stage === null) {
      updates.response_stage = null;
    } else if (typeof body.response_stage === "string") {
      if (!(INQUIRY_RESPONSE_STAGES as readonly string[]).includes(body.response_stage)) {
        return NextResponse.json({ message: "response_stage 값이 허용 목록에 없습니다." }, { status: 400 });
      }
      updates.response_stage = body.response_stage;
    } else {
      return NextResponse.json({ message: "response_stage 형식이 올바르지 않습니다." }, { status: 400 });
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "수정할 필드를 보내 주세요." }, { status: 400 });
  }

  const now = new Date().toISOString();
  updates.response_updated_at = now;
  updates.last_activity_at = now;

  const { data, error } = await supabaseAdmin
    .from("inquiries")
    .update(updates)
    .eq("id", inquiryId)
    .select("*")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ message: "응대 정보 저장에 실패했습니다." }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
  }

  const inquiry = normalizeInquiryRow(data as Record<string, unknown>);

  const { error: logErr } = await appendInquiryActivityLog(supabaseAdmin, {
    inquiry_id: inquiryId,
    activity_type: "response_saved",
    actor_name: "관리자",
    summary: "응대 체크리스트/단계/메모 저장",
    metadata: {
      response_stage: inquiry.response_stage ?? null,
      has_note: Boolean((inquiry.response_note ?? "").trim()),
      checklist_keys: inquiry.response_checklist ? Object.keys(inquiry.response_checklist) : [],
    },
  });
  if (logErr) {
    console.error("[response-guide] activity log failed", logErr);
  }

  return NextResponse.json({ inquiry });
}
