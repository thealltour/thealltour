"use client";

import Link from "next/link";
import type { ProductReviewSummary } from "@/types/reviewSummaries";
import { ReviewSummaryTagList } from "./ReviewSummaryTagList";

type ProductReviewSummaryCardProps = {
  summary: ProductReviewSummary;
};

function SentimentBadge({ sentiment }: { sentiment: string }) {
  const classes =
    sentiment === "positive"
      ? "bg-green-100 text-green-800"
      : sentiment === "negative"
        ? "bg-red-100 text-red-800"
        : "bg-amber-100 text-amber-800";
  const label = sentiment === "positive" ? "긍정" : sentiment === "negative" ? "부정" : "혼재";
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  );
}

export function ProductReviewSummaryCard({ summary }: ProductReviewSummaryCardProps) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)]/50 pb-3">
        <Link
          href={`/products/${summary.productId}`}
          className="font-semibold text-[var(--primary)] hover:underline"
        >
          {summary.productId}
        </Link>
        <SentimentBadge sentiment={summary.sentiment} />
        <span className="text-sm text-[var(--text-muted)]">
          리뷰 {summary.totalReviews}개 · 평균 ★ {summary.averageRating.toFixed(1)}
        </span>
      </div>
      <p className="mt-3 text-sm leading-relaxed text-[var(--text-primary)]">
        {summary.summaryText}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ReviewSummaryTagList label="장점 (Pros)" items={summary.pros} />
        <ReviewSummaryTagList label="단점 (Cons)" items={summary.cons} />
        <ReviewSummaryTagList label="추천 대상" items={summary.recommendedFor} />
        <ReviewSummaryTagList label="주의사항" items={summary.cautionPoints} />
        <ReviewSummaryTagList label="키워드" items={summary.topKeywords} />
      </div>
      {summary.highlights.length > 0 && (
        <div className="mt-3">
          <ReviewSummaryTagList label="하이라이트" items={summary.highlights} />
        </div>
      )}
      <p className="mt-3 text-xs text-[var(--text-muted)]">
        트렌드: {summary.recentTrendSummary}
      </p>
    </div>
  );
}
