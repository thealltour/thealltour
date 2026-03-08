/**
 * PR20/PR24: 리뷰 신고 접수, report_count 연동, 자동 moderation.
 */
import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { incrementReviewReport, applyAutomatedModeration } from "@/lib/reviewModeration";
import type { ReviewReportReason, ReviewReportSummary } from "@/types/reviewReports";

export type ReportReason = ReviewReportReason;

const VALID_REASONS: ReviewReportReason[] = [
  "spam",
  "abusive",
  "irrelevant",
  "misleading",
  "duplicate",
  "other",
];

function normalizeReason(reason: string): ReviewReportReason {
  const r = reason.trim().toLowerCase();
  if (VALID_REASONS.includes(r as ReviewReportReason)) return r as ReviewReportReason;
  return "other";
}

/**
 * 리뷰 신고 접수: insert + report_count 증가 + 자동 moderation 평가.
 */
export async function reportReview(
  reviewId: string,
  reason: string,
  memberId: string,
): Promise<{
  success: boolean;
  message?: string;
  reportCount?: number;
  autoModerationApplied?: boolean;
  nextStatus?: string;
}> {
  const { data: existing } = await supabaseAdmin
    .from("review_reports")
    .select("id")
    .eq("review_id", reviewId)
    .eq("member_id", memberId)
    .limit(1)
    .maybeSingle();

  if (existing) {
    return { success: false, message: "이미 해당 후기를 신고하셨습니다." };
  }

  const normalizedReason = normalizeReason(reason.trim() || "other");
  const { error } = await supabaseAdmin.from("review_reports").insert({
    review_id: reviewId,
    member_id: memberId,
    reason: normalizedReason,
    status: "pending",
  });

  if (error) {
    return { success: false, message: "신고 접수에 실패했습니다." };
  }

  const ok = await incrementReviewReport(reviewId);
  if (!ok) {
    return { success: true, message: "신고 접수됐으나 집계 반영에 실패할 수 있습니다." };
  }

  const autoResult = await applyAutomatedModeration(reviewId);
  return {
    success: true,
    autoModerationApplied: autoResult.changed,
    nextStatus: autoResult.changed ? autoResult.nextStatus : undefined,
  };
}

/** 리뷰별 신고 사유 집계 */
export function summarizeReviewReports(
  reports: Array<{ review_id: string; reason: string; created_at: string }>,
): Map<string, ReviewReportSummary> {
  const byReview = new Map<string, ReviewReportSummary>();
  const emptyReasons = (): Record<ReviewReportReason, number> =>
    Object.fromEntries(VALID_REASONS.map((r) => [r, 0])) as Record<ReviewReportReason, number>;

  for (const r of reports) {
    const id = r.review_id;
    let sum = byReview.get(id);
    if (!sum) {
      sum = { reviewId: id, totalReports: 0, reasons: emptyReasons() };
      byReview.set(id, sum);
    }
    sum.totalReports++;
    const reason = normalizeReason(r.reason);
    sum.reasons[reason] = (sum.reasons[reason] ?? 0) + 1;
    if (!sum.latestReportedAt || r.created_at > sum.latestReportedAt) {
      sum.latestReportedAt = r.created_at;
    }
  }
  return byReview;
}

export async function getReviewReportSummary(reviewId: string): Promise<ReviewReportSummary | null> {
  const { data } = await supabaseAdmin
    .from("review_reports")
    .select("review_id, reason, created_at")
    .eq("review_id", reviewId);

  if (!data?.length) return null;
  const map = summarizeReviewReports(
    data as Array<{ review_id: string; reason: string; created_at: string }>,
  );
  return map.get(reviewId) ?? null;
}

export function getGroupedReportReasons(
  reports: Array<{ reason: string }>,
): Record<ReviewReportReason, number> {
  const empty = Object.fromEntries(
    VALID_REASONS.map((r) => [r, 0]),
  ) as Record<ReviewReportReason, number>;
  for (const r of reports) {
    const key = normalizeReason(r.reason);
    empty[key] = (empty[key] ?? 0) + 1;
  }
  return empty;
}

/** 여러 리뷰의 신고 집계 일괄 조회 */
export async function getReviewReportSummariesBatch(
  reviewIds: string[],
): Promise<Map<string, ReviewReportSummary>> {
  if (reviewIds.length === 0) return new Map();
  const { data } = await supabaseAdmin
    .from("review_reports")
    .select("review_id, reason, created_at")
    .in("review_id", reviewIds);
  if (!data?.length) return new Map();
  return summarizeReviewReports(
    data as Array<{ review_id: string; reason: string; created_at: string }>,
  );
}
