"use client";

import Link from "next/link";
import type { PublicReviewItem } from "@/types/review";

type TopRecommendedReviewsProps = {
  reviews: (PublicReviewItem & { recommendationScore?: number })[];
};

function VerifiedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
      인증
    </span>
  );
}

export function TopRecommendedReviews({ reviews }: TopRecommendedReviewsProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">추천 리뷰 Top 10</h3>
        <p className="mt-2 text-xs text-[var(--text-muted)]">데이터가 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">추천 리뷰 Top 10</h3>
      <p className="mt-0.5 text-xs text-[var(--text-muted)]">recommendationScore 기준</p>
      <ul className="mt-4 space-y-3">
        {reviews.map((r, i) => {
          const preview = (r.summary ?? r.content ?? "").trim().slice(0, 80);
          return (
            <li
              key={r.id}
              className="flex flex-col gap-1 border-b border-[var(--border)]/50 pb-3 last:border-0 last:pb-0"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-[var(--text-muted)]">{i + 1}.</span>
                {r.eligibility_id && <VerifiedBadge />}
                <span className="text-xs text-amber-600">★ {r.rating ?? "-"}</span>
                <span className="text-xs text-[var(--text-secondary)]">
                  도움됨 {r.helpfulCount ?? 0}
                </span>
                {typeof r.recommendationScore === "number" && (
                  <span className="text-xs text-[var(--text-muted)]">
                    점수 {r.recommendationScore}
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-sm text-[var(--text-primary)]">
                {preview}
                {preview.length >= 80 ? "…" : ""}
              </p>
              <Link
                href={`/reviews/${r.id}`}
                className="text-xs font-medium text-[var(--primary)] hover:underline"
              >
                보기 →
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
