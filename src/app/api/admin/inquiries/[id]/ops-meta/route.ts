import { NextResponse } from "next/server";
import { requireAdminSession } from "@/lib/apiAuth";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeInquiryRow } from "@/lib/inquiries/normalizeInquiryRow";
import {
  appendInquiryActivityLog,
  formatFollowUpSummaryKo,
  LEAD_PRIORITY_KO,
} from "@/lib/inquiries/inquiryActivityLog";
import { INQUIRY_LEAD_PRIORITIES, type InquiryLeadPriority } from "@/types/inquiry";

const DEFAULT_ACTOR = "관리자";

type PatchBody = {
  assignee_id?: string | null;
  assignee_name?: string | null;
  lead_priority?: InquiryLeadPriority | null;
  next_action?: string | null;
  follow_up_at?: string | null;
  last_contacted_at?: string | null;
};

function parseUuidOrNull(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  if (!t) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(t)) return t;
  return undefined;
}

function parsePriority(raw: unknown): InquiryLeadPriority | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return undefined;
  const v = raw.trim() as InquiryLeadPriority;
  return (INQUIRY_LEAD_PRIORITIES as readonly string[]).includes(v) ? v : undefined;
}

function parseIsoOrNull(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null || raw === "") return null;
  if (typeof raw !== "string") return undefined;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function parseTextOrNull(raw: unknown): string | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length === 0 ? null : t;
}

function displayAssignee(name: string | null | undefined, id: string | null | undefined): string | null {
  const n = (name ?? "").trim();
  if (n) return n;
  const i = (id ?? "").trim();
  if (i) return `담당(ID)`;
  return null;
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

  const { data: prevRow, error: fetchErr } = await supabaseAdmin.from("inquiries").select("*").eq("id", inquiryId).maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ message: "문의를 불러오지 못했습니다." }, { status: 500 });
  }
  if (!prevRow) {
    return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
  }

  const prev = prevRow as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  const now = new Date().toISOString();

  const nextAssigneeId = parseUuidOrNull(body.assignee_id);
  if (nextAssigneeId === undefined && body.assignee_id !== undefined && body.assignee_id !== null && body.assignee_id !== "") {
    return NextResponse.json({ message: "assignee_id 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const nextAssigneeName = parseTextOrNull(body.assignee_name);
  const nextPriority = parsePriority(body.lead_priority);
  if (nextPriority === undefined && body.lead_priority != null) {
    return NextResponse.json({ message: "lead_priority는 high, medium, low 중 하나여야 합니다." }, { status: 400 });
  }
  const nextNextAction = parseTextOrNull(body.next_action);
  const nextFollowUp = parseIsoOrNull(body.follow_up_at);
  if (nextFollowUp === undefined && body.follow_up_at !== undefined && body.follow_up_at !== null && body.follow_up_at !== "") {
    return NextResponse.json({ message: "follow_up_at 날짜 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const nextLastContacted = parseIsoOrNull(body.last_contacted_at);
  if (
    nextLastContacted === undefined &&
    body.last_contacted_at !== undefined &&
    body.last_contacted_at !== null &&
    body.last_contacted_at !== ""
  ) {
    return NextResponse.json({ message: "last_contacted_at 날짜 형식이 올바르지 않습니다." }, { status: 400 });
  }

  if (nextAssigneeId !== undefined) updates.assignee_id = nextAssigneeId;
  if (nextAssigneeName !== undefined) updates.assignee_name = nextAssigneeName;
  if (nextPriority !== undefined) updates.lead_priority = nextPriority;
  if (nextNextAction !== undefined) updates.next_action = nextNextAction;
  if (nextFollowUp !== undefined) updates.follow_up_at = nextFollowUp;
  if (nextLastContacted !== undefined) updates.last_contacted_at = nextLastContacted;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "수정할 필드를 보내 주세요." }, { status: 400 });
  }

  updates.last_activity_at = now;

  const prevName = typeof prev.assignee_name === "string" ? prev.assignee_name : null;
  const prevId = typeof prev.assignee_id === "string" ? prev.assignee_id : null;
  const prevP = typeof prev.lead_priority === "string" ? prev.lead_priority : null;
  const prevNa = typeof prev.next_action === "string" ? prev.next_action : null;
  const prevFu = typeof prev.follow_up_at === "string" ? prev.follow_up_at : null;
  const prevLc = typeof prev.last_contacted_at === "string" ? prev.last_contacted_at : null;

  const finalName = nextAssigneeName !== undefined ? nextAssigneeName : prevName;
  const finalId = nextAssigneeId !== undefined ? nextAssigneeId : prevId;
  const finalP = nextPriority !== undefined ? nextPriority : prevP;
  const finalNa = nextNextAction !== undefined ? nextNextAction : prevNa;
  const finalFu = nextFollowUp !== undefined ? nextFollowUp : prevFu;
  const finalLc = nextLastContacted !== undefined ? nextLastContacted : prevLc;

  const logs: Array<{ activity_type: "assigned" | "unassigned" | "priority_changed" | "followup_updated"; summary: string; metadata?: Record<string, unknown> }> = [];

  if (nextAssigneeId !== undefined || nextAssigneeName !== undefined) {
    const before = displayAssignee(prevName, prevId);
    const after = displayAssignee(finalName, finalId);
    if (!before && after) {
      logs.push({ activity_type: "assigned", summary: `담당자 지정: ${after}`, metadata: { assignee_name: finalName, assignee_id: finalId } });
    } else if (before && !after) {
      logs.push({ activity_type: "unassigned", summary: "담당 해제", metadata: { previous: before } });
    } else if (before && after && before !== after) {
      logs.push({
        activity_type: "assigned",
        summary: `담당자 변경: ${before} → ${after}`,
        metadata: { from: before, to: after, assignee_name: finalName, assignee_id: finalId },
      });
    }
  }

  if (nextPriority !== undefined) {
    const oldL = prevP && (prevP as InquiryLeadPriority) in LEAD_PRIORITY_KO ? LEAD_PRIORITY_KO[prevP as InquiryLeadPriority] : prevP ?? "—";
    const newL = finalP && (finalP as InquiryLeadPriority) in LEAD_PRIORITY_KO ? LEAD_PRIORITY_KO[finalP as InquiryLeadPriority] : finalP ?? "—";
    if (prevP !== finalP) {
      logs.push({
        activity_type: "priority_changed",
        summary: `우선순위 변경: ${oldL} → ${newL}`,
        metadata: { from: prevP, to: finalP },
      });
    }
  }

  if (nextNextAction !== undefined && prevNa !== finalNa) {
    logs.push({
      activity_type: "followup_updated",
      summary: "다음 액션 업데이트",
      metadata: { next_action: finalNa },
    });
  }

  if (nextFollowUp !== undefined && prevFu !== finalFu) {
    logs.push({
      activity_type: "followup_updated",
      summary: `팔로업 일정 설정: ${formatFollowUpSummaryKo(finalFu)}`,
      metadata: { follow_up_at: finalFu },
    });
  }

  if (nextLastContacted !== undefined && prevLc !== finalLc) {
    logs.push({
      activity_type: "followup_updated",
      summary: `마지막 고객 연락 시각 업데이트: ${formatFollowUpSummaryKo(finalLc)}`,
      metadata: { last_contacted_at: finalLc },
    });
  }

  const { data: updated, error: upErr } = await supabaseAdmin
    .from("inquiries")
    .update(updates)
    .eq("id", inquiryId)
    .select("*")
    .maybeSingle();

  if (upErr) {
    return NextResponse.json({ message: "운영 정보 저장에 실패했습니다." }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json({ message: "문의를 찾을 수 없습니다." }, { status: 404 });
  }

  for (const log of logs) {
    const { error: logErr } = await appendInquiryActivityLog(supabaseAdmin, {
      inquiry_id: inquiryId,
      activity_type: log.activity_type,
      actor_name: DEFAULT_ACTOR,
      summary: log.summary,
      metadata: log.metadata ?? null,
    });
    if (logErr) {
      console.error("[ops-meta] activity log insert failed", logErr);
    }
  }

  const inquiry = normalizeInquiryRow(updated as Record<string, unknown>);
  return NextResponse.json({ inquiry });
}
