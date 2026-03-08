/**
 * PR29: 리뷰 운영 알림 persistence (review_system_notifications 테이블).
 */
import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { ReviewSystemEvent } from "@/types/reviewNotifications";
import type { ReviewNotificationItem, ReviewNotificationSummary } from "@/types/reviewNotifications";
import type { ReviewNotificationStatus } from "@/types/reviewNotifications";
import { buildNotificationDedupeKey } from "./reviewNotificationDedupe";

const TABLE = "review_system_notifications";

type DbRow = {
  id: string;
  event_key: string;
  category: string;
  severity: string;
  status: string;
  product_id: string | null;
  review_id: string | null;
  title: string;
  message: string;
  dedupe_key: string | null;
  source_metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

function toItem(row: DbRow): ReviewNotificationItem {
  return {
    id: row.id,
    eventKey: row.event_key,
    category: row.category as ReviewNotificationItem["category"],
    severity: row.severity as ReviewNotificationItem["severity"],
    status: row.status as ReviewNotificationStatus,
    productId: row.product_id,
    reviewId: row.review_id,
    title: row.title,
    message: row.message,
    createdAt: row.created_at,
    dedupeKey: row.dedupe_key,
    sourceMetadata: row.source_metadata ?? undefined,
  };
}

/**
 * 이벤트 배열을 알림으로 저장. dedupeKey는 호출 전에 설정된 이벤트만 사용.
 */
export async function createReviewNotifications(
  events: Array<ReviewSystemEvent & { dedupeKey?: string }>,
): Promise<{ created: number; failed: number }> {
  if (events.length === 0) return { created: 0, failed: 0 };
  const now = new Date().toISOString();
  let created = 0;
  let failed = 0;
  for (const e of events) {
    const dedupeKey = e.dedupeKey ?? buildNotificationDedupeKey(e);
    const row = {
      event_key: e.eventKey,
      category: e.category,
      severity: e.severity,
      status: "unread",
      product_id: e.productId ?? null,
      review_id: e.reviewId ?? null,
      title: e.title,
      message: e.message,
      dedupe_key: dedupeKey,
      source_metadata: e.metadata ?? null,
      created_at: now,
      updated_at: now,
    };
    const { error } = await supabaseAdmin.from(TABLE).insert(row);
    if (error) failed++;
    else created++;
  }
  return { created, failed };
}

export interface ListReviewNotificationsFilters {
  status?: ReviewNotificationStatus | "all";
  severity?: ReviewNotificationItem["severity"] | "all";
  category?: ReviewNotificationItem["category"];
  productId?: string;
  limit?: number;
  offset?: number;
}

/**
 * 알림 목록 조회.
 */
export async function listReviewNotifications(
  filters?: ListReviewNotificationsFilters,
): Promise<ReviewNotificationItem[]> {
  let query = supabaseAdmin
    .from(TABLE)
    .select("id, event_key, category, severity, status, product_id, review_id, title, message, dedupe_key, source_metadata, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }
  if (filters?.severity && filters.severity !== "all") {
    query = query.eq("severity", filters.severity);
  }
  if (filters?.category) {
    query = query.eq("category", filters.category);
  }
  if (filters?.productId) {
    query = query.eq("product_id", filters.productId);
  }
  const limit = Math.min(filters?.limit ?? 100, 200);
  const offset = filters?.offset ?? 0;
  const { data, error } = await query.range(offset, offset + limit - 1);

  if (error) return [];
  return (data ?? []).map((r) => toItem(r as DbRow));
}

/**
 * 단건 읽음 처리.
 */
export async function markReviewNotificationAsRead(id: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .update({ status: "read", updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

/**
 * 전체 읽음 처리.
 */
export async function markAllReviewNotificationsAsRead(): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .update({ status: "read", updated_at: new Date().toISOString() })
    .eq("status", "unread");
  return !error;
}

/**
 * 단건 보관(archived).
 */
export async function archiveReviewNotification(id: string): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from(TABLE)
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", id);
  return !error;
}

/**
 * 요약 집계.
 */
export async function getReviewNotificationSummary(): Promise<ReviewNotificationSummary> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .select("status, severity");

  if (error) {
    return { total: 0, unread: 0, critical: 0, warning: 0, info: 0 };
  }
  const rows = (data ?? []) as Array<{ status: string; severity: string }>;
  let unread = 0;
  let critical = 0;
  let warning = 0;
  let info = 0;
  for (const r of rows) {
    if (r.status === "unread") unread++;
    if (r.severity === "critical") critical++;
    else if (r.severity === "warning") warning++;
    else if (r.severity === "info") info++;
  }
  return {
    total: rows.length,
    unread,
    critical,
    warning,
    info,
  };
}
