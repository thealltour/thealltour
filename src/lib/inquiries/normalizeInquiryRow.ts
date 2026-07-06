import { normalizeDesiredDepartureSnapshot } from "@/lib/inquiry/desiredDeparture";
import {
  INQUIRY_LEAD_PRIORITIES,
  INQUIRY_RESPONSE_STAGES,
  type BookingStatus,
  type ConsultationStatus,
  type Inquiry,
  type InquiryLeadPriority,
  type InquiryResponseStage,
  type QuoteSnapshot,
} from "@/types/inquiry";

function normalizeResponseChecklist(raw: unknown): Record<string, boolean> | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "boolean") out[k] = v;
  }
  return out;
}

function normalizeResponseStage(raw: unknown): InquiryResponseStage | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return null;
  return (INQUIRY_RESPONSE_STAGES as readonly string[]).includes(raw) ? (raw as InquiryResponseStage) : null;
}

function normalizeLeadPriority(raw: unknown): InquiryLeadPriority | null | undefined {
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  if (typeof raw !== "string") return null;
  return (INQUIRY_LEAD_PRIORITIES as readonly string[]).includes(raw) ? (raw as InquiryLeadPriority) : null;
}

/** API·DB row → Inquiry (문의 목록/상세 공통) */
export function normalizeInquiryRow(row: Record<string, unknown>): Inquiry {
  const quoteSnapshotRaw = row.quote_snapshot;
  let quote_snapshot: Inquiry["quote_snapshot"] = undefined;
  if (quoteSnapshotRaw && typeof quoteSnapshotRaw === "object") {
    const o = quoteSnapshotRaw as Record<string, unknown>;
    const qs = o.quoteSummary as Record<string, unknown> | undefined;
    const desiredDeparture =
      normalizeDesiredDepartureSnapshot(o.desiredDeparture) ??
      normalizeDesiredDepartureSnapshot(
        typeof o.desired_departure === "string" ? { date: o.desired_departure } : undefined,
      );
    const golfBriefRaw = o.golf_brief;
    let golf_brief: QuoteSnapshot["golf_brief"];
    if (golfBriefRaw && typeof golfBriefRaw === "object" && !Array.isArray(golfBriefRaw)) {
      golf_brief = Object.fromEntries(
        Object.entries(golfBriefRaw as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        ),
      );
    }
    quote_snapshot = {
      selectedOptions:
        o.selectedOptions && typeof o.selectedOptions === "object"
          ? (o.selectedOptions as Record<string, string>)
          : undefined,
      quoteSummary: qs
        ? {
            total: qs.total as number | null,
            basePrice: qs.basePrice as number | null,
            breakdown: Array.isArray(qs.breakdown)
              ? (qs.breakdown as Array<{ groupLabel: string; optionLabel: string; priceDelta: number }>)
              : [],
          }
        : undefined,
      inquiredAt: typeof o.inquiredAt === "string" ? o.inquiredAt : undefined,
      desiredDeparture,
      golf_brief: golf_brief && Object.keys(golf_brief).length > 0 ? golf_brief : undefined,
      pointsUseRequested:
        typeof o.pointsUseRequested === "number" && Number.isFinite(o.pointsUseRequested)
          ? o.pointsUseRequested
          : undefined,
      pointsBalanceAtSubmit:
        typeof o.pointsBalanceAtSubmit === "number" && Number.isFinite(o.pointsBalanceAtSubmit)
          ? o.pointsBalanceAtSubmit
          : undefined,
    };
    const hasData =
      quote_snapshot.selectedOptions ||
      quote_snapshot.quoteSummary ||
      quote_snapshot.inquiredAt ||
      quote_snapshot.desiredDeparture ||
      quote_snapshot.golf_brief ||
      quote_snapshot.pointsUseRequested;
    if (!hasData) {
      quote_snapshot = undefined;
    }
  }

  const checklistNorm = normalizeResponseChecklist(row.response_checklist);
  const stageNorm = normalizeResponseStage(row.response_stage);

  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    phone: String(row.phone ?? ""),
    content: String(row.content ?? ""),
    product_id: typeof row.product_id === "string" ? row.product_id : undefined,
    product_title: typeof row.product_title === "string" ? row.product_title : undefined,
    source_path: typeof row.source_path === "string" ? row.source_path : undefined,
    is_completed: typeof row.is_completed === "boolean" ? row.is_completed : undefined,
    customer_profile_id: typeof row.customer_profile_id === "string" ? row.customer_profile_id : undefined,
    member_id: typeof row.member_id === "string" ? row.member_id : row.member_id != null ? String(row.member_id) : undefined,
    consultation_status:
      typeof row.consultation_status === "string" ? (row.consultation_status as ConsultationStatus) : undefined,
    booking_status: typeof row.booking_status === "string" ? (row.booking_status as BookingStatus) : undefined,
    completed_at: typeof row.completed_at === "string" ? row.completed_at : undefined,
    created_at: typeof row.created_at === "string" ? row.created_at : undefined,
    quote_snapshot: quote_snapshot ?? undefined,
    first_touch:
      row.first_touch != null && typeof row.first_touch === "object"
        ? (row.first_touch as Inquiry["first_touch"])
        : undefined,
    inquiry_page_url: typeof row.inquiry_page_url === "string" ? row.inquiry_page_url : undefined,
    acquisition_channel: typeof row.acquisition_channel === "string" ? row.acquisition_channel : undefined,
    acquisition_source_label:
      typeof row.acquisition_source_label === "string" ? row.acquisition_source_label : undefined,
    acquisition_medium: typeof row.acquisition_medium === "string" ? row.acquisition_medium : undefined,
    acquisition_summary: typeof row.acquisition_summary === "string" ? row.acquisition_summary : undefined,
    first_landing_path: typeof row.first_landing_path === "string" ? row.first_landing_path : undefined,
    response_checklist: checklistNorm,
    response_note:
      row.response_note === undefined
        ? undefined
        : row.response_note === null
          ? null
          : typeof row.response_note === "string"
            ? row.response_note
            : undefined,
    response_stage: stageNorm,
    response_updated_at:
      row.response_updated_at === undefined
        ? undefined
        : row.response_updated_at === null
          ? null
          : typeof row.response_updated_at === "string"
            ? row.response_updated_at
            : undefined,
    assignee_id:
      row.assignee_id === undefined
        ? undefined
        : row.assignee_id === null
          ? null
          : typeof row.assignee_id === "string"
            ? row.assignee_id
            : undefined,
    assignee_name:
      row.assignee_name === undefined
        ? undefined
        : row.assignee_name === null
          ? null
          : typeof row.assignee_name === "string"
            ? row.assignee_name
            : undefined,
    lead_priority: normalizeLeadPriority(row.lead_priority),
    next_action:
      row.next_action === undefined
        ? undefined
        : row.next_action === null
          ? null
          : typeof row.next_action === "string"
            ? row.next_action
            : undefined,
    follow_up_at:
      row.follow_up_at === undefined
        ? undefined
        : row.follow_up_at === null
          ? null
          : typeof row.follow_up_at === "string"
            ? row.follow_up_at
            : undefined,
    last_contacted_at:
      row.last_contacted_at === undefined
        ? undefined
        : row.last_contacted_at === null
          ? null
          : typeof row.last_contacted_at === "string"
            ? row.last_contacted_at
            : undefined,
    last_activity_at:
      row.last_activity_at === undefined
        ? undefined
        : row.last_activity_at === null
          ? null
          : typeof row.last_activity_at === "string"
            ? row.last_activity_at
            : undefined,
  };
}
