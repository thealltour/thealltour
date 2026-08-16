"use client";

import Link from "next/link";
import { useState } from "react";
import { postReviewModerationAction, type ReviewModerationActionName } from "@/components/admin/reviews/reviewModeration.actions";
import { ReviewStatusBadge } from "./ReviewStatusBadge";
import { ReviewReportReasonBadgeList } from "./ReviewReportReasonBadgeList";
import { ReviewAuthorRiskBadge } from "./ReviewAuthorRiskBadge";
import { fromDbStatus } from "@/types/reviewModeration";
import { getReviewContentPreview } from "@/lib/reviewSearchConstants";
import type { ReviewReportReason } from "@/types/reviewReports";

type ModerationReview = {
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
};

type ModerationReviewCardProps = {
  review: ModerationReview;
  onActionDone?: () => void;
  priorityLevel?: "high" | "medium" | "low";
  reportReasons?: Record<ReviewReportReason, number>;
  autoModerationHint?: string;
  authorRiskLevel?: "low" | "medium" | "high";
  authorTrustScore?: number;
  authorReviewCount?: number;
};

function formatDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

export function ModerationReviewCard({
  review,
  onActionDone,
  priorityLevel,
  reportReasons,
  autoModerationHint,
  authorRiskLevel,
  authorTrustScore,
  authorReviewCount,
}: ModerationReviewCardProps) {
  const [loading, setLoading] = useState<ReviewModerationActionName | null>(null);

  async function runAction(action: ReviewModerationActionName, reason?: string) {
    setLoading(action);
    try {
      const result = await postReviewModerationAction(review.id, action, { reason });
      if (result.ok) onActionDone?.();
      else alert(result.message);
    } finally {
      setLoading(null);
    }
  }

  const status = fromDbStatus(review.status);
  const preview = getReviewContentPreview(review.content, 100);

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/reviews/${review.id}`}
              className="font-mono text-sm font-medium text-[var(--primary)] hover:underline"
            >
              {review.id.slice(0, 8)}…
            </Link>
            <ReviewStatusBadge status={status} />
            {priorityLevel && (
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  priorityLevel === "high"
                    ? "bg-red-100 text-red-800"
                    : priorityLevel === "medium"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-slate-100 text-slate-700"
                }`}
              >
                {priorityLevel === "high" ? "High Priority" : priorityLevel === "medium" ? "Medium" : "Low"}
              </span>
            )}
            {review.report_count > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                신고 {review.report_count}
              </span>
            )}
            {reportReasons && Object.values(reportReasons).some((c) => c > 0) && (
              <ReviewReportReasonBadgeList reasons={reportReasons} />
            )}
            {autoModerationHint && (
              <span className="text-xs text-[var(--text-muted)]">{autoModerationHint}</span>
            )}
            {authorRiskLevel && (
              <ReviewAuthorRiskBadge level={authorRiskLevel} />
            )}
            {typeof authorTrustScore === "number" && (
              <span className="text-xs text-[var(--text-muted)]">작성자 Trust {authorTrustScore}</span>
            )}
            {typeof authorReviewCount === "number" && authorReviewCount > 1 && (
              <span className="text-xs text-[var(--text-muted)]">동일 작성자 {authorReviewCount}건</span>
            )}
            {review.eligibility_id && (
              <span className="text-xs text-blue-600">인증</span>
            )}
          </div>
          {review.product_id && (
            <Link
              href={`/products/${review.product_id}`}
              className="mt-1 block text-xs text-[var(--text-muted)]"
            >
              {review.product_id}
            </Link>
          )}
        </div>
        <div className="text-sm text-[var(--text-muted)]">
          ★ {review.rating ?? "—"} · {formatDate(review.created_at)}
        </div>
      </div>
      {review.title && (
        <h3 className="mt-2 line-clamp-1 font-medium text-[var(--text-primary)]">{review.title}</h3>
      )}
      <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">{preview || "내용 없음"}</p>
      {review.moderation_reason && (
        <p className="mt-1 text-xs text-amber-700">사유: {review.moderation_reason}</p>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {status !== "hidden" && (
          <button
            type="button"
            disabled={!!loading}
            onClick={() => runAction("hide")}
            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
          >
            Hide
          </button>
        )}
        {status === "hidden" && (
          <button
            type="button"
            disabled={!!loading}
            onClick={() => runAction("restore")}
            className="rounded border border-[var(--success)]/50 bg-[var(--success-bg)] px-2 py-1 text-xs text-[var(--success)] hover:opacity-90 disabled:opacity-50"
          >
            Restore
          </button>
        )}
        {status !== "under_review" && (
          <button
            type="button"
            disabled={!!loading}
            onClick={() => runAction("under_review")}
            className="rounded border border-[var(--warning)]/50 bg-[var(--warning-bg)] px-2 py-1 text-xs text-[var(--warning)] hover:opacity-90 disabled:opacity-50"
          >
            Mark Under Review
          </button>
        )}
        {(status === "under_review" || status === "flagged") && (
          <button
            type="button"
            disabled={!!loading}
            onClick={() => runAction("resolve")}
            className="rounded border border-[var(--primary)]/40 bg-[var(--primary-soft)] px-2 py-1 text-xs text-[var(--primary)] hover:opacity-90 disabled:opacity-50"
          >
            Resolve
          </button>
        )}
      </div>
    </article>
  );
}
