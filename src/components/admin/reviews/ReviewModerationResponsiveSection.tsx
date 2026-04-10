"use client";

import { useIsMobileAdmin } from "@/components/admin/mobile/useIsMobileAdmin";
import { MobileReviewModerationSection } from "@/components/admin/mobile/reviews/MobileReviewModerationSection";
import {
  ReviewModerationDashboard,
  type ReviewModerationDashboardProps,
} from "@/components/admin/reviews/ReviewModerationDashboard";

export function ReviewModerationResponsiveSection(props: ReviewModerationDashboardProps) {
  const { isMobileAdmin, isReady } = useIsMobileAdmin();

  if (!isReady || !isMobileAdmin) {
    return <ReviewModerationDashboard {...props} />;
  }

  return (
    <MobileReviewModerationSection
      reviews={props.reviews}
      queueItems={props.queueItems}
      summary={props.summary}
      authorProfileByReviewId={props.authorProfileByReviewId ?? {}}
    />
  );
}
