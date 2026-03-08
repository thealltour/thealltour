/**
 * PR13: 리뷰 리마인더 생성·취소.
 * 여행 완료 시 3일/7일 리마인더 예약, 후기 제출 시 남은 리마인더 취소.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getTravelBookingById } from "@/lib/travelBookings";
import type { ReviewEligibility } from "@/types/reviewEligibility";

const REMINDER_3D = "reminder_3d";
const REMINDER_7D = "reminder_7d";
const STATUS_SCHEDULED = "scheduled";

export type ReviewReminderType = typeof REMINDER_3D | typeof REMINDER_7D;
export type ReviewReminderStatus = "scheduled" | "sent" | "cancelled";

export type ReviewReminder = {
  id: string;
  eligibility_id: string;
  member_id: string | null;
  reminder_type: ReviewReminderType;
  scheduled_at: string;
  sent_at: string | null;
  status: ReviewReminderStatus;
  created_at: string;
};

function toReminder(row: Record<string, unknown>): ReviewReminder {
  return {
    id: String(row.id ?? ""),
    eligibility_id: String(row.eligibility_id ?? ""),
    member_id: typeof row.member_id === "string" ? row.member_id : null,
    reminder_type: (row.reminder_type as ReviewReminderType) ?? REMINDER_3D,
    scheduled_at: String(row.scheduled_at ?? ""),
    sent_at: typeof row.sent_at === "string" ? row.sent_at : null,
    status: (row.status as ReviewReminderStatus) ?? STATUS_SCHEDULED,
    created_at: String(row.created_at ?? ""),
  };
}

/**
 * 여행 완료 시 리마인더 2건 생성 (3일 후, 7일 후).
 * scheduled_at = travel_completed_at + 3d / + 7d.
 */
export async function createReviewReminders(
  eligibility: ReviewEligibility,
): Promise<ReviewReminder[]> {
  const booking = await getTravelBookingById(eligibility.booking_id);
  const completedAt = booking?.travel_completed_at;
  if (!completedAt) {
    return [];
  }

  const base = new Date(completedAt);
  const scheduled3d = new Date(base);
  scheduled3d.setDate(scheduled3d.getDate() + 3);
  const scheduled7d = new Date(base);
  scheduled7d.setDate(scheduled7d.getDate() + 7);

  const memberId = eligibility.claimed_by_member_id ?? null;
  const rows = [
    {
      eligibility_id: eligibility.id,
      member_id: memberId,
      reminder_type: REMINDER_3D,
      scheduled_at: scheduled3d.toISOString(),
      status: STATUS_SCHEDULED,
    },
    {
      eligibility_id: eligibility.id,
      member_id: memberId,
      reminder_type: REMINDER_7D,
      scheduled_at: scheduled7d.toISOString(),
      status: STATUS_SCHEDULED,
    },
  ];

  const { data, error } = await supabaseAdmin
    .from("review_reminders")
    .insert(rows)
    .select("*");

  if (error) return [];
  return (data ?? []).map((row) => toReminder(row as Record<string, unknown>));
}

/**
 * 후기 제출 시 해당 eligibility의 남은(scheduled) 리마인더 취소.
 */
export async function cancelReviewReminders(eligibilityId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("review_reminders")
    .update({ status: "cancelled" })
    .eq("eligibility_id", eligibilityId)
    .eq("status", STATUS_SCHEDULED)
    .select("id");

  if (error) return 0;
  return (data ?? []).length;
}

/**
 * 발송 예정(scheduled_at <= now, status = scheduled) 리마인더 목록 조회.
 */
export async function getDueReviewReminders(limit = 100): Promise<ReviewReminder[]> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from("review_reminders")
    .select("*")
    .eq("status", STATUS_SCHEDULED)
    .lte("scheduled_at", now)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error) return [];
  return (data ?? []).map((row) => toReminder(row as Record<string, unknown>));
}

/**
 * 발송 처리: status = sent, sent_at = now.
 */
export async function markReminderSent(reminderId: string): Promise<boolean> {
  const now = new Date().toISOString();
  const { error } = await supabaseAdmin
    .from("review_reminders")
    .update({ status: "sent", sent_at: now })
    .eq("id", reminderId)
    .eq("status", STATUS_SCHEDULED);

  return !error;
}

/** 관리자: 단일 리마인더 취소 (id 기준) */
export async function cancelReminderById(reminderId: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from("review_reminders")
    .update({ status: "cancelled" })
    .eq("id", reminderId)
    .eq("status", STATUS_SCHEDULED);

  return !error;
}

/** 관리자 UI: 필터/페이지네이션용 목록 조회 */
export async function getReviewRemindersList(options: {
  status?: ReviewReminderStatus;
  limit?: number;
  offset?: number;
}): Promise<{ rows: ReviewReminder[]; total: number }> {
  const limit = Math.min(options.limit ?? 50, 200);
  const offset = options.offset ?? 0;

  let query = supabaseAdmin
    .from("review_reminders")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  if (options.status) {
    query = query.eq("status", options.status);
  }

  const { data, error, count } = await query.range(offset, offset + limit - 1);

  if (error) return { rows: [], total: 0 };
  const rows = (data ?? []).map((row) => toReminder(row as Record<string, unknown>));
  return { rows, total: count ?? 0 };
}

/** id로 리마인더 1건 조회 */
export async function getReviewReminderById(id: string): Promise<ReviewReminder | null> {
  const { data, error } = await supabaseAdmin
    .from("review_reminders")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return toReminder(data as Record<string, unknown>);
}

/** 발송 실행 (로그/알림). 추후 email/kakao 연동 시 여기서 발송. */
export async function executeReminderSend(reminderId: string): Promise<boolean> {
  const reminder = await getReviewReminderById(reminderId);
  if (!reminder || reminder.status !== STATUS_SCHEDULED) return false;

  const { getEligibilityById } = await import("@/lib/reviewEligibilities");
  const eligibility = await getEligibilityById(reminder.eligibility_id);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://thealltour.com").replace(/\/$/, "");
  const claimLink = eligibility?.claim_token
    ? `${siteUrl}/reviews/claim/${eligibility.claim_token}`
    : null;

  const message = [
    "여행은 즐거우셨나요?",
    "더올투어에서 다녀오신 여행 후기를 남겨주세요.",
    "다른 여행자들에게 큰 도움이 됩니다.",
    claimLink ? `후기 작성하기: ${claimLink}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  if (process.env.NODE_ENV !== "test") {
    console.info("[review-reminder]", {
      reminderId,
      eligibilityId: reminder.eligibility_id,
      memberId: reminder.member_id ?? "(미연결)",
      reminderType: reminder.reminder_type,
      claimLink,
      messagePreview: message.slice(0, 80) + "...",
    });
  }

  return markReminderSent(reminderId);
}
