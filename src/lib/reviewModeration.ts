/**
 * PR20: 리뷰 Moderation 서비스.
 * PR24: 자동 평가·적용·히스토리 연동.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { toDbStatus } from "@/types/reviewModeration";
import type { ReviewModerationStatus } from "@/types/reviewModeration";
import {
  REVIEW_REPORT_FLAG_THRESHOLD,
  REVIEW_REPORT_UNDER_REVIEW_THRESHOLD,
  REVIEW_REPORT_HIDE_THRESHOLD,
  REVIEW_HIGH_RISK_TRUST_SCORE_THRESHOLD,
  REVIEW_LOW_TRUST_SCORE_THRESHOLD,
  REVIEW_SUSPICIOUS_RISK_THRESHOLD,
} from "@/lib/reviewModerationConstants";
import { createModerationHistoryLog } from "@/lib/reviewModerationHistory";

const AUTO_FLAG_THRESHOLD = REVIEW_REPORT_FLAG_THRESHOLD;

/**
 * 관리자 리뷰 상태 변경.
 */
export async function updateReviewStatus(
  reviewId: string,
  status: ReviewModerationStatus,
  reason?: string,
): Promise<boolean> {
  const dbStatus = toDbStatus(status);
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    status: dbStatus,
    updated_at: now,
    last_moderated_at: now,
  };
  if (reason !== undefined) {
    payload.moderation_reason = reason || null;
  }

  const { error } = await supabaseAdmin
    .from("reviews")
    .update(payload)
    .eq("id", reviewId);

  return !error;
}

/**
 * 신고 수 증가. report_count >= AUTO_FLAG_THRESHOLD 이면 status = flagged.
 */
export async function incrementReviewReport(reviewId: string): Promise<boolean> {
  const { data: row, error: fetchError } = await supabaseAdmin
    .from("reviews")
    .select("report_count, status")
    .eq("id", reviewId)
    .single();

  if (fetchError || !row) return false;

  const current = (row as { report_count?: number; status?: string }).report_count ?? 0;
  const nextCount = current + 1;
  const updates: Record<string, unknown> = {
    report_count: nextCount,
    updated_at: new Date().toISOString(),
  };
  if (nextCount >= AUTO_FLAG_THRESHOLD) {
    updates.status = "flagged";
    updates.last_moderated_at = new Date().toISOString();
  }

  const { error } = await supabaseAdmin
    .from("reviews")
    .update(updates)
    .eq("id", reviewId);

  return !error;
}

/**
 * 검토 대상 리뷰 조회: status != submitted(visible) 이거나 report_count > 0.
 * draft 제외.
 */
export async function getReviewsForModeration(): Promise<
  Array<{
    id: string;
    product_id: string | null;
    title: string;
    content: string;
    author_name: string;
    created_at: string | null;
    rating: number | null;
    status: string;
    report_count: number;
    last_moderated_at: string | null;
    moderation_reason: string | null;
    eligibility_id: string | null;
    image_url: string | null;
    image_urls: string[] | null;
  }>
> {
  const { data: reviews, error } = await supabaseAdmin
    .from("reviews")
    .select("id, title, content, author_name, created_at, rating, status, report_count, last_moderated_at, moderation_reason, eligibility_id, image_url, image_urls, booking_id")
    .not("status", "eq", "draft")
    .or("status.neq.submitted,report_count.gt.0")
    .order("report_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(500);

  if (error || !reviews?.length) return [];

  const bookingIds = (reviews as Record<string, unknown>[])
    .map((r) => r.booking_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);
  const unique = [...new Set(bookingIds)];
  let productMap = new Map<string, string>();
  if (unique.length > 0) {
    const { data: bookings } = await supabaseAdmin
      .from("travel_bookings")
      .select("id, product_id")
      .in("id", unique);
    for (const b of bookings ?? []) {
      const row = b as { id: string; product_id: string };
      productMap.set(row.id, row.product_id);
    }
  }

  return (reviews as Record<string, unknown>[]).map((r) => {
    const bookingId = r.booking_id as string | undefined;
    const product_id = bookingId ? productMap.get(bookingId) ?? null : null;
    return {
      id: String(r.id),
      product_id,
      title: String(r.title ?? ""),
      content: String(r.content ?? ""),
      author_name: String(r.author_name ?? ""),
      created_at: r.created_at != null ? String(r.created_at) : null,
      rating: typeof r.rating === "number" ? r.rating : null,
      status: String(r.status ?? "submitted"),
      report_count: typeof r.report_count === "number" ? r.report_count : 0,
      last_moderated_at: r.last_moderated_at != null ? String(r.last_moderated_at) : null,
      moderation_reason: r.moderation_reason != null ? String(r.moderation_reason) : null,
      eligibility_id: r.eligibility_id != null ? String(r.eligibility_id) : null,
      image_url: r.image_url != null ? String(r.image_url) : null,
      image_urls: Array.isArray(r.image_urls) ? (r.image_urls as string[]) : null,
    };
  });
}

/** PR24: 자동 moderation 평가 결과 */
export type EvaluateModerationResult = {
  nextStatus: ReviewModerationStatus;
  reasons: string[];
  severity: "low" | "medium" | "high";
};

/** PR24: 리뷰 1건에 대한 moderation 상태 판정 */
export function evaluateReviewModerationStatus(context: {
  reportCount: number;
  trustScore?: number;
  anomalyRiskScore?: number;
  currentStatus?: string;
}): EvaluateModerationResult {
  const { reportCount, trustScore = 100, anomalyRiskScore = 0 } = context;
  const reasons: string[] = [];
  let nextStatus: ReviewModerationStatus = "visible";

  if (reportCount >= REVIEW_REPORT_HIDE_THRESHOLD) {
    nextStatus = "hidden";
    reasons.push("신고 수가 임계치를 초과했습니다.");
  } else if (reportCount >= REVIEW_REPORT_FLAG_THRESHOLD) {
    nextStatus = "flagged";
    reasons.push("신고 다수 접수");
  } else if (reportCount >= REVIEW_REPORT_UNDER_REVIEW_THRESHOLD) {
    nextStatus = "under_review";
    reasons.push("신고 접수");
  }

  if (trustScore < REVIEW_HIGH_RISK_TRUST_SCORE_THRESHOLD && nextStatus === "visible") {
    nextStatus = "under_review";
    reasons.push("신뢰도 점수가 매우 낮습니다.");
  } else if (trustScore < REVIEW_LOW_TRUST_SCORE_THRESHOLD && nextStatus === "visible") {
    nextStatus = "under_review";
    reasons.push("신뢰도 점수 낮음");
  }

  if (anomalyRiskScore >= REVIEW_SUSPICIOUS_RISK_THRESHOLD && nextStatus === "visible") {
    nextStatus = "under_review";
    reasons.push("스팸/중복 패턴 위험이 감지되었습니다.");
  }

  const severity: "low" | "medium" | "high" =
    nextStatus === "hidden" || reasons.length >= 3 ? "high" : nextStatus === "flagged" ? "medium" : "low";

  return { nextStatus, reasons, severity };
}

/** PR24: 단일 리뷰 자동 moderation 적용 */
export type ApplyAutomatedModerationResult = {
  reviewId: string;
  previousStatus: string;
  nextStatus: string;
  changed: boolean;
  reasons: string[];
};

export async function applyAutomatedModeration(
  reviewId: string,
  options?: { trustScore?: number; anomalyRiskScore?: number },
): Promise<ApplyAutomatedModerationResult> {
  const { data: row } = await supabaseAdmin
    .from("reviews")
    .select("id, status, report_count")
    .eq("id", reviewId)
    .single();

  if (!row) {
    return { reviewId, previousStatus: "", nextStatus: "", changed: false, reasons: [] };
  }

  const r = row as { id: string; status: string; report_count: number };
  const previousStatus = r.status ?? "submitted";
  const reportCount = typeof r.report_count === "number" ? r.report_count : 0;
  const evalResult = evaluateReviewModerationStatus({
    reportCount,
    trustScore: options?.trustScore,
    anomalyRiskScore: options?.anomalyRiskScore,
    currentStatus: previousStatus,
  });

  const dbNext = toDbStatus(evalResult.nextStatus);
  if (dbNext === previousStatus) {
    return {
      reviewId,
      previousStatus,
      nextStatus: evalResult.nextStatus,
      changed: false,
      reasons: evalResult.reasons,
    };
  }

  const ok = await updateReviewStatus(reviewId, evalResult.nextStatus, evalResult.reasons[0]);
  if (!ok) {
    return { reviewId, previousStatus, nextStatus: evalResult.nextStatus, changed: false, reasons: evalResult.reasons };
  }

  const actionType =
    evalResult.nextStatus === "hidden"
      ? "auto_hidden"
      : evalResult.nextStatus === "flagged"
        ? "auto_flagged"
        : "auto_under_review";
  await createModerationHistoryLog({
    reviewId,
    actionType,
    fromStatus: previousStatus,
    toStatus: dbNext,
    reason: evalResult.reasons[0],
    actorType: "system",
  });

  return {
    reviewId,
    previousStatus,
    nextStatus: evalResult.nextStatus,
    changed: true,
    reasons: evalResult.reasons,
  };
}

/** PR24: 신고 누적 리뷰 일괄 자동 moderation */
export async function applyAutomatedModerationForReportedReviews(options?: {
  trustScoreByReviewId?: Map<string, number>;
  anomalyRiskByReviewId?: Map<string, number>;
}): Promise<ApplyAutomatedModerationResult[]> {
  const reviews = await getReviewsForModeration();
  const results: ApplyAutomatedModerationResult[] = [];
  for (const rev of reviews) {
    if ((rev.report_count ?? 0) === 0) continue;
    const r = await applyAutomatedModeration(rev.id, {
      trustScore: options?.trustScoreByReviewId?.get(rev.id),
      anomalyRiskScore: options?.anomalyRiskByReviewId?.get(rev.id),
    });
    results.push(r);
  }
  return results;
}
