"use client";

import Link from "next/link";
import { useState } from "react";
import { ReviewStatusBadge } from "@/components/admin/reviews/ReviewStatusBadge";
import { ReviewAuthorRiskBadge } from "@/components/admin/reviews/ReviewAuthorRiskBadge";
import { fromDbStatus } from "@/types/reviewModeration";
import { getReviewContentPreview } from "@/lib/reviewSearchConstants";
import {
  postReviewModerationAction,
  type ReviewModerationActionName,
} from "@/components/admin/reviews/reviewModeration.actions";
import type { MobileModerationReviewRow } from "@/components/admin/mobile/reviews/useMobileReviewModerationSections";

type MobileModerationReviewCardProps = {
  review: MobileModerationReviewRow;
  onActionDone?: () => void;
  priorityLevel?: "high" | "medium" | "low";
  authorRiskLevel?: "low" | "medium" | "high";
  authorTrustScore?: number;
};

function formatDate(v: string | null) {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

export function MobileModerationReviewCard({
  review,
  onActionDone,
  priorityLevel,
  authorRiskLevel,
  authorTrustScore,
}: MobileModerationReviewCardProps) {
  const [loading, setLoading] = useState<ReviewModerationActionName | null>(null);

  async function runAction(action: ReviewModerationActionName) {
    setLoading(action);
    try {
      const result = await postReviewModerationAction(review.id, action);
      if (result.ok) onActionDone?.();
      else alert(result.message);
    } finally {
      setLoading(null);
    }
  }

  const status = fromDbStatus(review.status);
  const preview = getReviewContentPreview(review.content, 160);

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-soft)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Link
              href={`/reviews/${review.id}`}
              className="font-mono text-xs font-semibold text-[var(--primary)] hover:underline"
              aria-label={`리뷰 ${review.id.slice(0, 8)} 상세`}
            >
              {review.id.slice(0, 8)}…
            </Link>
            <ReviewStatusBadge status={status} />
            {priorityLevel ? (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  priorityLevel === "high"
                    ? "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200"
                    : priorityLevel === "medium"
                      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200"
                      : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
                }`}
              >
                {priorityLevel === "high" ? "우선" : priorityLevel === "medium" ? "중간" : "일반"}
              </span>
            ) : null}
            {review.report_count > 0 ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-800 dark:bg-red-900/40 dark:text-red-200">
                신고 {review.report_count}
              </span>
            ) : null}
            {authorRiskLevel ? <ReviewAuthorRiskBadge level={authorRiskLevel} /> : null}
            {typeof authorTrustScore === "number" ? (
              <span className="text-[11px] text-[var(--text-muted)]">Trust {authorTrustScore}</span>
            ) : null}
          </div>
          <p className="text-sm font-medium text-[var(--text-primary)]">{review.author_name || "익명"}</p>
          {review.product_id ? (
            <Link
              href={`/products/${review.product_id}`}
              className="block truncate text-xs text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              상품 {review.product_id.slice(0, 12)}
              {review.product_id.length > 12 ? "…" : ""}
            </Link>
          ) : null}
        </div>
        <p className="shrink-0 text-xs text-[var(--text-muted)]" aria-label="평점 및 작성일">
          ★ {review.rating ?? "—"} · {formatDate(review.created_at)}
        </p>
      </div>

      {review.title ? (
        <h3 className="mt-2 line-clamp-2 text-sm font-semibold text-[var(--text-primary)]">{review.title}</h3>
      ) : null}
      <p className="mt-1 line-clamp-4 text-sm leading-relaxed text-[var(--text-secondary)]">
        {preview || "내용 없음"}
      </p>
      {review.moderation_reason ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">사유: {review.moderation_reason}</p>
      ) : null}

      <div className="mt-3 flex max-w-full flex-wrap gap-1.5">
        {status !== "hidden" && (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => runAction("hide")}
            aria-label="리뷰 숨기기"
            className="min-h-9 rounded-lg border border-slate-300 bg-[var(--surface)] px-3 py-1.5 text-xs font-medium hover:bg-[var(--surface-muted)] disabled:opacity-50 dark:border-slate-600"
          >
            {loading === "hide" ? "처리 중…" : "숨김"}
          </button>
        )}
        {status === "hidden" && (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => runAction("restore")}
            aria-label="리뷰 복원"
            className="min-h-9 rounded-lg border border-[var(--success)]/50 bg-[var(--success-bg)] px-3 py-1.5 text-xs font-medium text-[var(--success)] hover:opacity-90 disabled:opacity-50"
          >
            {loading === "restore" ? "처리 중…" : "복원"}
          </button>
        )}
        {status !== "under_review" && (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => runAction("under_review")}
            aria-label="검토 중으로 표시"
            className="min-h-9 rounded-lg border border-[var(--warning)]/50 bg-[var(--warning-bg)] px-3 py-1.5 text-xs font-medium text-[var(--warning)] hover:opacity-90 disabled:opacity-50"
          >
            {loading === "under_review" ? "처리 중…" : "검토 중"}
          </button>
        )}
        {(status === "under_review" || status === "flagged") && (
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => runAction("resolve")}
            aria-label="검토 완료 처리"
            className="min-h-9 rounded-lg border border-[var(--primary)]/40 bg-[var(--primary-soft)] px-3 py-1.5 text-xs font-medium text-[var(--primary)] hover:opacity-90 disabled:opacity-50"
          >
            {loading === "resolve" ? "처리 중…" : "완료"}
          </button>
        )}
      </div>
    </article>
  );
}
