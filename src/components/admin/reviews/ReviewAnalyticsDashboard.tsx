"use client";

import { ReviewAnalyticsKPI } from "./ReviewAnalyticsKPI";
import { RatingDistributionChart } from "./RatingDistributionChart";
import { TrustScoreDistributionChart } from "./TrustScoreDistributionChart";
import { ReviewActivityChart } from "./ReviewActivityChart";
import { TopRecommendedReviews } from "./TopRecommendedReviews";
import { TopHelpfulReviews } from "./TopHelpfulReviews";
import type { ReviewAnalyticsResult } from "@/types/reviewAnalytics";

type ReviewAnalyticsDashboardProps = {
  analytics: ReviewAnalyticsResult;
};

export function ReviewAnalyticsDashboard({ analytics }: ReviewAnalyticsDashboardProps) {
  return (
    <div className="space-y-8">
      <section>
        <ReviewAnalyticsKPI analytics={analytics} />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RatingDistributionChart analytics={analytics} />
        <ReviewActivityChart analytics={analytics} />
      </section>

      {analytics.trustScoreDistribution && (
        <section>
          <TrustScoreDistributionChart analytics={analytics} />
        </section>
      )}

      <section>
        <TopRecommendedReviews reviews={analytics.topRecommendedReviews} />
      </section>

      <section>
        <TopHelpfulReviews reviews={analytics.topHelpfulReviews} />
      </section>
    </div>
  );
}
