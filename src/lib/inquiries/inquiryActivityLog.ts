import type { SupabaseClient } from "@supabase/supabase-js";
import type { InquiryActivityLog, InquiryActivityType, InquiryLeadPriority } from "@/types/inquiry";

export const CONSULTATION_STATUS_KO: Record<string, string> = {
  new: "신규",
  contacted: "상담중",
  closed: "상담종료",
  on_hold: "보류",
};

export const BOOKING_STATUS_KO: Record<string, string> = {
  none: "미확정",
  reserved: "예약확정",
  completed: "여행완료",
  canceled: "취소",
};

export const LEAD_PRIORITY_KO: Record<InquiryLeadPriority, string> = {
  high: "높음",
  medium: "보통",
  low: "낮음",
};

type InsertParams = {
  inquiry_id: string;
  activity_type: InquiryActivityType;
  actor_id?: string | null;
  actor_name?: string | null;
  summary: string;
  metadata?: Record<string, unknown> | null;
};

export async function appendInquiryActivityLog(client: SupabaseClient, p: InsertParams): Promise<{ error: Error | null }> {
  const { error } = await client.from("inquiry_activity_logs").insert({
    inquiry_id: p.inquiry_id,
    activity_type: p.activity_type,
    actor_id: p.actor_id ?? null,
    actor_name: p.actor_name ?? null,
    summary: p.summary,
    metadata: p.metadata ?? null,
  });
  return { error: error ? new Error(error.message) : null };
}

export function normalizeActivityLogRow(row: Record<string, unknown>): InquiryActivityLog {
  const meta = row.metadata;
  return {
    id: String(row.id ?? ""),
    inquiry_id: String(row.inquiry_id ?? ""),
    activity_type: (typeof row.activity_type === "string" ? row.activity_type : "manual_log") as InquiryActivityType,
    actor_id: typeof row.actor_id === "string" ? row.actor_id : row.actor_id === null ? null : undefined,
    actor_name: typeof row.actor_name === "string" ? row.actor_name : row.actor_name === null ? null : undefined,
    summary: typeof row.summary === "string" ? row.summary : "",
    metadata:
      meta != null && typeof meta === "object" && !Array.isArray(meta) ? (meta as Record<string, unknown>) : null,
    created_at: typeof row.created_at === "string" ? row.created_at : "",
  };
}

export function formatFollowUpSummaryKo(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
