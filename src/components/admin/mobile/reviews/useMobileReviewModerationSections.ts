"use client";

import { useMemo } from "react";
import { fromDbStatus } from "@/types/reviewModeration";
import type { ReviewModerationStatus } from "@/types/reviewModeration";

export type MobileModerationReviewRow = {
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

function filterByStatus(reviews: MobileModerationReviewRow[], status: ReviewModerationStatus) {
  return reviews.filter((r) => fromDbStatus(r.status) === status);
}

/**
 * ReviewModerationDashboard 와 동일한 분류 규칙으로 모바일 섹션용 리스트를 나눕니다.
 */
export function partitionReviewsForMobileModeration(reviews: MobileModerationReviewRow[]) {
  const flagged = reviews.filter((r) => r.report_count > 0 || fromDbStatus(r.status) === "flagged");
  const underReview = filterByStatus(reviews, "under_review").filter(
    (r) => !flagged.some((f) => f.id === r.id),
  );
  const hidden = filterByStatus(reviews, "hidden");
  return { flagged, underReview, hidden };
}

export function useMobileReviewModerationSections(reviews: MobileModerationReviewRow[]) {
  return useMemo(() => partitionReviewsForMobileModeration(reviews), [reviews]);
}
