"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useReviewExperimentTracking } from "@/hooks/useReviewExperimentTracking";
import type { PublicReviewItem } from "@/types/review";
import type { ReviewRenderStrategy } from "@/types/reviewExperiment";
import type { ProductReviewStats, ProductReviewSummaryForDisplay } from "@/types/review";
import ReviewHelpfulButton from "@/components/reviews/ReviewHelpfulButton";
import { ProductReviewSeoSummary } from "@/components/products/ProductReviewSeoSummary";
import { PersonalizedReviewHighlights } from "@/components/products/PersonalizedReviewHighlights";
import { TrackedReviewDetailLink } from "@/components/products/TrackedReviewDetailLink";
import type { ReviewExperimentKey, ReviewExperimentVariant } from "@/types/reviewExperiment";
import type { ReviewPersonalizationContext } from "@/types/reviewPersonalization";

type HighlightItem = {
  review: PublicReviewItem;
  personalizedScore?: number;
  matchedReasons?: string[];
};

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" });
}

function Stars({ rating }: { rating?: number }) {
  if (rating == null || rating < 1 || rating > 5) {
    return <span className="text-sm text-slate-400">별점 없음</span>;
  }
  const r = Math.round(rating);
  return (
    <span className="text-amber-500">
      {"★".repeat(r)}
      <span className="text-slate-300">{"☆".repeat(5 - r)}</span>
    </span>
  );
}

function isVerified(r: PublicReviewItem) {
  return !!(r as { eligibility_id?: string }).eligibility_id;
}
function VerifiedBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
      인증된 여행 후기
    </span>
  );
}

/** 서버에서 내려준 summary만으로 카드 렌더 (server-only 미사용) */
function ProductReviewSummaryBlock({
  summary,
}: {
  summary: ProductReviewSummaryForDisplay | null;
}) {
  if (
    !summary ||
    summary.status !== "ready" ||
    summary.review_count < 2 ||
    !summary.summary_text?.trim()
  ) {
    return null;
  }
  const avg =
    summary.average_rating != null ? summary.average_rating.toFixed(1) : null;
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5 shadow-sm">
      <h3 className="text-base font-bold text-slate-900">리뷰 한눈에 보기</h3>
      <p className="mt-1 text-sm text-slate-500">
        {avg != null && `평균 평점 ${avg}점`}
        {avg != null && " · "}
        리뷰 {summary.review_count}개 기반
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-700">
        {summary.summary_text}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {summary.positive_points.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-green-700">좋아요</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-600">
              {summary.positive_points.map((point, i) => (
                <li key={`p-${i}`}>{point}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.negative_points.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">아쉬워요</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-600">
              {summary.negative_points.map((point, i) => (
                <li key={`n-${i}`}>{point}</li>
              ))}
            </ul>
          </div>
        )}
        {summary.recommended_for.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">이런 분께 추천</p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-slate-600">
              {summary.recommended_for.map((point, i) => (
                <li key={`r-${i}`}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <p className="mt-4 text-xs text-slate-500">
        AI가 리뷰를 바탕으로 요약한 내용입니다.
      </p>
    </div>
  );
}

type ExperimentedReviewSectionContentProps = {
  experimentKey: ReviewExperimentKey;
  variant: ReviewExperimentVariant;
  productId: string;
  productTitle: string;
  strategy: ReviewRenderStrategy;
  stats: ProductReviewStats;
  summary: ProductReviewSummaryForDisplay | null;
  displayReviews: PublicReviewItem[];
  highlightItems: HighlightItem[];
  sectionTitle: string;
  personalizationContext: ReviewPersonalizationContext;
  bestReview: PublicReviewItem | null;
};

export function ExperimentedReviewSectionContent({
  experimentKey,
  variant,
  productId,
  strategy,
  stats,
  summary,
  displayReviews,
  highlightItems,
  sectionTitle,
  personalizationContext,
  bestReview,
}: ExperimentedReviewSectionContentProps) {
  const { sendImpression } = useReviewExperimentTracking({
    experimentKey,
    variant,
    productId,
    enabled: true,
  });

  useEffect(() => {
    sendImpression();
  }, [sendImpression]);

  const showPersonalizedBlock = highlightItems.length > 0 && variant === "personalized_highlights";
  const showSummaryFirst = strategy.showSummaryFirst && !!summary?.summary_text;
  const title = strategy.title ?? "여행 후기";
  const subtitle = strategy.subtitle ?? "실제 여행자들의 생생한 후기를 확인하세요";
  const avg = stats.averageRating.toFixed(1);

  return (
    <section id="reviews" className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
        <ProductReviewSeoSummary
          averageRating={stats.averageRating}
          reviewCount={stats.reviewCount}
          summaryText={summary?.summary_text ?? undefined}
        />
      </div>

      {showSummaryFirst && <ProductReviewSummaryBlock summary={summary} />}

      {showPersonalizedBlock && (
        <PersonalizedReviewHighlights
          reviews={highlightItems.map((h) => ({
            review: h.review,
            personalizedScore: h.personalizedScore ?? 0,
            matchedReasons: h.matchedReasons ?? [],
          }))}
          title={sectionTitle}
          context={personalizationContext}
          productId={productId}
          experimentKey={experimentKey}
          variant={variant}
        />
      )}

      {!showSummaryFirst && <ProductReviewSummaryBlock summary={summary} />}

      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-xl bg-slate-50 p-4">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-slate-900">★ {avg}</span>
          <span className="text-sm text-slate-600">/ 5</span>
        </div>
        <span className="text-sm text-slate-600">후기 {stats.reviewCount}개</span>
        {stats.verifiedCount > 0 && (
          <span className="text-sm text-blue-700">인증 후기 {stats.verifiedCount}개</span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {displayReviews.map((review) => (
          <article
            key={review.id}
            className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
          >
            {bestReview && review.id === bestReview.id && !showPersonalizedBlock && (
              <div className="bg-[var(--accent-premium-soft)] px-4 py-2 text-center text-sm font-semibold text-[var(--accent-premium)]">
                BEST REVIEW
              </div>
            )}
            <div className="flex flex-1 flex-col p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                {isVerified(review) && <VerifiedBadge />}
                <Stars rating={review.rating} />
                <span className="text-xs text-slate-500">{formatDate(review.created_at)}</span>
              </div>
              <h3 className="font-semibold text-slate-900 line-clamp-2">{review.title}</h3>
              {review.summary && (
                <p className="mt-1 text-sm text-slate-600 line-clamp-1">{review.summary}</p>
              )}
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                {(review.summary?.trim() || review.content?.trim() || "")
                  .split(/\n/)
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(" ")
                  .slice(0, 120)}
                …
              </p>
              {(review.image_urls?.length ? review.image_urls : review.image_url ? [review.image_url] : []).slice(0, 3).length > 0 && (
                <div className="mt-3 flex gap-2">
                  {(review.image_urls?.length ? review.image_urls : review.image_url ? [review.image_url] : [])
                    .slice(0, 3)
                    .map((url, i) => (
                      <div
                        key={`${url}-${i}`}
                        className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100"
                      >
                        <Image
                          src={url}
                          alt={review.product_title ? `${review.product_title} 여행 후기 이미지` : "여행 후기 이미지"}
                          fill
                          sizes="64px"
                          className="object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
                <TrackedReviewDetailLink
                  reviewId={review.id}
                  productId={productId}
                  experimentKey={experimentKey}
                  variant={variant}
                >
                  자세히 보기 →
                </TrackedReviewDetailLink>
                <ReviewHelpfulButton
                  reviewId={review.id}
                  helpfulCount={review.helpfulCount}
                  viewerVotedHelpful={review.viewerVotedHelpful}
                />
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link
          href={`/reviews?productId=${encodeURIComponent(productId)}`}
          className="inline-flex items-center justify-center rounded-full bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          전체 후기 보기
        </Link>
      </div>
    </section>
  );
}
