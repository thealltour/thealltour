"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AdminReviewListItem } from "@/types/reviewSearch";
import { getReviewContentPreview, getReviewImageCount } from "@/lib/reviewSearchConstants";
import { ReviewStatusBadge } from "./ReviewStatusBadge";
import { ReviewTrustBadge } from "./ReviewTrustBadge";
import { ReviewReportReasonBadgeList } from "./ReviewReportReasonBadgeList";
import { ReviewAuthorRiskBadge } from "./ReviewAuthorRiskBadge";
import { fromDbStatus } from "@/types/reviewModeration";
import type { ReviewReportReason } from "@/types/reviewReports";

type AdminReviewListItemCardProps = {
  review: AdminReviewListItem;
  priorityLevel?: "high" | "medium" | "low";
  reportReasons?: Record<ReviewReportReason, number>;
  /** PR25: 작성자 위험도 */
  authorRiskLevel?: "low" | "medium" | "high";
  /** PR25: 작성자 Trust Score */
  authorTrustScore?: number;
  /** PR25: 동일 작성자 리뷰 수 */
  authorReviewCount?: number;
};

function formatDate(value: string | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
}

async function handleDeleteReview(id: string): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(`/api/admin/reviews/${id}`, { method: "DELETE" });
  const data = (await res.json()) as { message?: string };
  if (!res.ok) return { ok: false, message: data.message ?? "삭제에 실패했습니다." };
  return { ok: true };
}

/** 경량: 극단 평점 + 짧은 본문이면 검토 필요 힌트 */
function needsReviewHint(review: AdminReviewListItem): boolean {
  const r = review.rating ?? 0;
  const len = (review.content ?? "").trim().length;
  return (r === 1 || r === 5) && len < 20;
}

export function AdminReviewListItemCard({
  review,
  priorityLevel,
  reportReasons,
  authorRiskLevel,
  authorTrustScore,
  authorReviewCount,
}: AdminReviewListItemCardProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const imageCount = getReviewImageCount(review);
  const preview = getReviewContentPreview(review.content, 120);
  const verified = !!review.eligibility_id;
  const hint = needsReviewHint(review);

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:shadow-md">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/reviews/${review.id}`}
              className="font-mono text-sm font-medium text-[var(--primary)] hover:underline"
            >
              {review.id.slice(0, 8)}…
            </Link>
            {review.rating != null && review.rating >= 1 && review.rating <= 5 && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                ★ {Number(review.rating).toFixed(1)}
              </span>
            )}
            {imageCount > 0 && (
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-700">
                사진 {imageCount}장
              </span>
            )}
            {verified && (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                인증
              </span>
            )}
            {review.status != null && fromDbStatus(review.status) !== "visible" && (
              <ReviewStatusBadge status={review.status} />
            )}
            {(review.report_count ?? review.reportCount ?? 0) > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                신고 {review.report_count ?? review.reportCount ?? 0}
              </span>
            )}
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
                {priorityLevel === "high" ? "High" : priorityLevel === "medium" ? "Medium" : "Low"}
              </span>
            )}
            {reportReasons && Object.values(reportReasons).some((c) => c > 0) && (
              <ReviewReportReasonBadgeList reasons={reportReasons} />
            )}
            {hint && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                검토 필요
              </span>
            )}
            {typeof review.trustScore === "number" && (
              <>
                <ReviewTrustBadge trustScore={review.trustScore} />
                <span className="text-xs text-[var(--text-muted)]">Trust {review.trustScore}</span>
              </>
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
          </div>
          {review.product_id && (
            <Link
              href={`/products/${review.product_id}`}
              className="mt-1 block text-xs text-[var(--text-muted)] hover:text-[var(--primary)]"
            >
              {review.product_id}
            </Link>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm">
          <span className="text-amber-600">★ {review.rating ?? "—"}</span>
          <span className="text-[var(--text-muted)]">도움 {review.helpfulCount ?? 0}</span>
          {typeof review.recommendationScore === "number" && (
            <span className="font-medium text-[var(--text-secondary)]">
              점수 {review.recommendationScore}
            </span>
          )}
          <span className="text-xs text-[var(--text-muted)]">{formatDate(review.created_at)}</span>
          <button
            type="button"
            onClick={async () => {
              if (!confirm("이 후기를 완전히 삭제할까요? 삭제 후 복구할 수 없습니다.")) return;
              setDeleting(true);
              try {
                const result = await handleDeleteReview(review.id);
                if (result.ok) {
                  router.refresh();
                } else {
                  alert(result.message ?? "삭제에 실패했습니다.");
                }
              } finally {
                setDeleting(false);
              }
            }}
            disabled={deleting}
            className="text-xs text-red-600 hover:underline disabled:opacity-50"
          >
            {deleting ? "삭제 중…" : "삭제"}
          </button>
        </div>
      </div>
      {review.title && (
        <h3 className="mt-2 line-clamp-1 text-sm font-medium text-[var(--text-primary)]">
          {review.title}
        </h3>
      )}
      <p className="mt-1 line-clamp-2 text-sm text-[var(--text-secondary)]">
        {preview || "내용 없음"}
      </p>
    </article>
  );
}
