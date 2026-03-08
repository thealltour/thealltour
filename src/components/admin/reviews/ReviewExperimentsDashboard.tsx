"use client";

import { ReviewExperimentSummaryCards } from "./ReviewExperimentSummaryCards";
import { ReviewExperimentResultsTable } from "./ReviewExperimentResultsTable";
import type { ReviewExperimentResultSummary } from "@/types/reviewExperiment";

type WithLift = ReviewExperimentResultSummary & {
  ctrLift?: number;
  conversionLift?: number;
  expandLift?: number;
};

type ReviewExperimentsDashboardProps = {
  summaries: WithLift[];
};

export function ReviewExperimentsDashboard({ summaries }: ReviewExperimentsDashboardProps) {
  const totalImpressions = summaries.reduce((s, r) => s + r.impressions, 0);
  const totalClicks = summaries.reduce((s, r) => s + r.clicks, 0);
  const totalConversions = summaries.reduce((s, r) => s + r.conversions, 0);
  const experimentKeys = [...new Set(summaries.map((r) => r.experimentKey))];

  const rows = summaries.map((r) => ({
    experimentKey: r.experimentKey,
    variant: r.variant,
    impressions: r.impressions,
    clicks: r.clicks,
    ctr: r.ctr,
    expands: r.expands,
    expandRate: r.expandRate,
    conversions: r.conversions,
    conversionRate: r.conversionRate,
    ctrLift: r.ctrLift,
    conversionLift: r.conversionLift,
  }));

  return (
    <div className="space-y-8">
      <ReviewExperimentSummaryCards
        activeExperiments={experimentKeys.length}
        totalImpressions={totalImpressions}
        totalClicks={totalClicks}
        totalConversions={totalConversions}
      />

      <section>
        <h2 className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Variant별 성과</h2>
        <ReviewExperimentResultsTable rows={rows} />
      </section>
    </div>
  );
}
