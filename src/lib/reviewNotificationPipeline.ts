/**
 * PR29: 리뷰 운영 알림 파이프라인.
 * 이벤트 수집 → 빌드 → dedupe → 저장. cron/수동 실행 공통 사용.
 */
import "server-only";
import type { ReviewSystemEvent } from "@/types/reviewNotifications";
import type { ReviewNotificationItem } from "@/types/reviewNotifications";
import type { ReviewSystemEventSourceData } from "@/lib/reviewSystemEvents";
import { buildReviewSystemEvents } from "@/lib/reviewSystemEvents";
import { dedupeReviewSystemEvents } from "@/lib/reviewNotificationDedupe";
import { createReviewNotifications, listReviewNotifications } from "@/lib/reviewNotifications";
import { getReviewsForModeration } from "@/lib/reviewModeration";
import { detectReviewAnomalies } from "@/lib/reviewAnomalyDetection";
import type { ReviewForAnomaly } from "@/lib/reviewAnomalyDetection";
import { REVIEW_CRITICAL_REPORT_THRESHOLD } from "@/lib/reviewNotificationConstants";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export interface ReviewNotificationPipelineResult {
  totalEvents: number;
  createdNotifications: number;
  skippedByDedupe: number;
  failed: number;
}

/**
 * 소스 데이터 로드. 일부 실패해도 나머지 반환.
 */
export async function loadReviewSystemEventSourceData(): Promise<ReviewSystemEventSourceData> {
  const out: ReviewSystemEventSourceData = {};

  try {
    const queue = await getReviewsForModeration();
    out.moderationQueue = queue.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      status: r.status,
      report_count: r.report_count,
    }));
  } catch {
    out.moderationQueue = [];
  }

  try {
    const queue = out.moderationQueue ?? [];
    out.reportSummaries = queue
      .filter((r) => (r.report_count ?? 0) >= REVIEW_CRITICAL_REPORT_THRESHOLD)
      .map((r) => ({
        reviewId: r.id,
        productId: r.product_id ?? undefined,
        reportCount: r.report_count ?? 0,
      }));
  } catch {
    out.reportSummaries = [];
  }

  try {
    const { data: rows } = await supabaseAdmin
      .from("reviews")
      .select("id, product_id, rating, helpful_count, eligibility_id, created_at, content")
      .not("status", "eq", "draft")
      .order("created_at", { ascending: false })
      .limit(2000);
    const reviews: ReviewForAnomaly[] = (rows ?? []).map((r: Record<string, unknown>) => ({
      id: String(r.id),
      product_id: r.product_id != null ? String(r.product_id) : null,
      rating: typeof r.rating === "number" ? r.rating : undefined,
      helpfulCount: typeof r.helpful_count === "number" ? r.helpful_count : undefined,
      eligibility_id: r.eligibility_id != null ? String(r.eligibility_id) : undefined,
      created_at: r.created_at != null ? String(r.created_at) : undefined,
      content: typeof r.content === "string" ? r.content : undefined,
    }));
    out.anomalyResults = detectReviewAnomalies(reviews);
  } catch {
    out.anomalyResults = undefined;
  }

  return out;
}

/**
 * 이벤트 배열을 dedupe 후 알림으로 저장.
 */
export async function processReviewSystemEventsToNotifications(
  events: ReviewSystemEvent[],
): Promise<ReviewNotificationPipelineResult> {
  const totalEvents = events.length;
  if (totalEvents === 0) {
    return { totalEvents: 0, createdNotifications: 0, skippedByDedupe: 0, failed: 0 };
  }

  let existing: ReviewNotificationItem[] = [];
  try {
    existing = await listReviewNotifications({ limit: 300 });
  } catch {
    // dedupe 없이 진행
  }

  const deduped = dedupeReviewSystemEvents(events, existing);
  const skippedByDedupe = totalEvents - deduped.length;

  const { created, failed } = await createReviewNotifications(deduped);
  return {
    totalEvents,
    createdNotifications: created,
    skippedByDedupe,
    failed,
  };
}

/**
 * 시스템 상태에서 알림 생성 파이프라인 실행.
 * sourceData 미제공 시 내부에서 로드.
 */
export async function generateReviewNotificationsFromSystemState(
  sourceData?: ReviewSystemEventSourceData | null,
): Promise<ReviewNotificationPipelineResult> {
  const data = sourceData ?? (await loadReviewSystemEventSourceData());
  const events = buildReviewSystemEvents(data);
  return processReviewSystemEventsToNotifications(events);
}
