"use client";

import Link from "next/link";
import { useReviewExperimentTracking } from "@/hooks/useReviewExperimentTracking";
import type { ReviewExperimentKey, ReviewExperimentVariant } from "@/types/reviewExperiment";

type TrackedReviewDetailLinkProps = {
  reviewId: string;
  productId: string;
  experimentKey: ReviewExperimentKey;
  variant: ReviewExperimentVariant;
  children: React.ReactNode;
};

/**
 * 리뷰 "자세히 보기" 링크 + 실험 click_review 계측.
 */
export function TrackedReviewDetailLink({
  reviewId,
  productId,
  experimentKey,
  variant,
  children,
}: TrackedReviewDetailLinkProps) {
  const { trackClick } = useReviewExperimentTracking({
    experimentKey,
    variant,
    productId,
    enabled: true,
  });

  return (
    <Link
      href={`/reviews/${reviewId}`}
      className="text-sm font-medium text-blue-600 hover:text-blue-800"
      onClick={() => trackClick(reviewId)}
    >
      {children}
    </Link>
  );
}
