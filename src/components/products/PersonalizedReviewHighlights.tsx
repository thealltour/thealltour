/**
 * PR23: 개인화 추천 리뷰 하이라이트.
 * 상위 2~3개를 카드로 노출, matchedReasons 기반 추천 사유 표시.
 */
"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import type { PublicReviewItem } from "@/types/review";
import { getMatchedReasonLabels } from "@/lib/reviewPersonalizationLabels";
import type { PersonalizedReviewResult } from "@/types/reviewPersonalization";
import type { ReviewPersonalizationContext } from "@/types/reviewPersonalization";
import { trackPersonalizedReviewView } from "@/lib/reviewExperimentTracking";

export type PersonalizedReviewHighlightsProps = {
  reviews: Array<{
    review: PublicReviewItem;
    personalizedScore: number;
    matchedReasons: string[];
  }>;
  title?: string;
  context?: ReviewPersonalizationContext;
  /** PR27: 전환 분석용 - 개인화 블록 노출 시 personalized_review_view 이벤트 발행 */
  productId?: string;
  experimentKey?: string;
  variant?: string;
};

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("ko-KR", { year: "numeric", month: "short", day: "numeric" });
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

function contentPreview(content: string | undefined, summary: string | undefined, maxLen = 120) {
  const text = (summary ?? content ?? "").trim().replace(/\s+/g, " ");
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen) + "…";
}

export function PersonalizedReviewHighlights({
  reviews,
  title = "추천 리뷰",
  context,
  productId,
  experimentKey,
  variant,
}: PersonalizedReviewHighlightsProps) {
  const viewTracked = useRef(false);
  useEffect(() => {
    if (!productId || viewTracked.current) return;
    viewTracked.current = true;
    trackPersonalizedReviewView(productId, { experimentKey, variant });
  }, [productId, experimentKey, variant]);

  if (reviews.length === 0) return null;

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-base font-bold text-slate-900">{title}</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.slice(0, 3).map(({ review, personalizedScore, matchedReasons }) => {
          const labels = getMatchedReasonLabels(
            { reviewId: review.id, personalizedScore, matchedReasons },
            context,
          );
          const images = review.image_urls?.length ? review.image_urls : review.image_url ? [review.image_url] : [];
          const preview = contentPreview(review.content, review.summary);

          return (
            <article
              key={review.id}
              className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="flex flex-1 flex-col p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  {review.eligibility_id && (
                    <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                      인증
                    </span>
                  )}
                  <Stars rating={review.rating} />
                  <span className="text-xs text-slate-500">{formatDate(review.created_at)}</span>
                </div>
                {labels.length > 0 && (
                  <p className="mb-1 text-xs font-medium text-slate-600">
                    {labels[0]}
                    {labels.length > 1 ? ` · ${labels.slice(1).join(", ")}` : ""}
                  </p>
                )}
                {review.title && (
                  <h4 className="font-semibold text-slate-900 line-clamp-2">{review.title}</h4>
                )}
                <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-slate-600">
                  {preview || "내용 없음"}
                </p>
                {images.length > 0 && (
                  <div className="mt-3 flex gap-2">
                    {images.slice(0, 2).map((url, i) => (
                      <div
                        key={`${url}-${i}`}
                        className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100"
                      >
                        <Image
                          src={url}
                          alt=""
                          fill
                          sizes="56px"
                          className="object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                  </div>
                )}
                <Link
                  href={`/reviews/${review.id}`}
                  className="mt-3 inline-block text-sm font-medium text-blue-600 hover:text-blue-800"
                >
                  자세히 보기 →
                </Link>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
