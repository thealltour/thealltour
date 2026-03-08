"use client";

import type { ReviewAnomalyResult } from "@/types/reviewAnomalies";
import { AnomalySummaryCards } from "./AnomalySummaryCards";
import { AnomalyAlertsList } from "./AnomalyAlertsList";
import { RatingDropProductsTable } from "./RatingDropProductsTable";
import { ReviewSurgeProductsTable } from "./ReviewSurgeProductsTable";
import { SuspiciousReviewsTable } from "./SuspiciousReviewsTable";

type ReviewAnomaliesDashboardProps = {
  anomalies: ReviewAnomalyResult;
};

export function ReviewAnomaliesDashboard({ anomalies }: ReviewAnomaliesDashboardProps) {
  return (
    <div className="space-y-8">
      <section>
        <AnomalySummaryCards anomalies={anomalies} />
      </section>

      <section>
        <AnomalyAlertsList alerts={anomalies.alerts} />
      </section>

      <section>
        <RatingDropProductsTable products={anomalies.ratingDropProducts} />
      </section>

      <section>
        <ReviewSurgeProductsTable products={anomalies.surgeProducts} />
      </section>

      <section>
        <SuspiciousReviewsTable reviews={anomalies.suspiciousReviews} />
      </section>
    </div>
  );
}
