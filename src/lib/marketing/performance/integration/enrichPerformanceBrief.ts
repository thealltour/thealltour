import type { DailyPerformanceBriefArtifact } from "@/lib/marketing/cron/performanceBriefArtifact";
import type { ContentPerformanceSnapshot } from "@/lib/marketing/performance/types";
import { buildPerformanceAnalystInput } from "@/lib/marketing/performance/integration/performanceAnalystInput";
import { buildMarketingManagerPerformanceContext } from "@/lib/marketing/performance/integration/marketingManagerPerformanceContext";
import { isVerificationRecord } from "@/lib/marketing/operations/verification";

export function enrichPerformanceBriefWithManualSnapshots(
  brief: DailyPerformanceBriefArtifact,
  snapshots: ContentPerformanceSnapshot[],
): DailyPerformanceBriefArtifact {
  const productionSnapshots = snapshots.filter(
    (snapshot) =>
      !isVerificationRecord({
        candidateId: snapshot.candidateId,
        logicalObservationKey: snapshot.logicalObservationKey,
      }),
  );
  if (productionSnapshots.length === 0) return brief;

  const analyst = buildPerformanceAnalystInput({ snapshots: productionSnapshots });
  const mmContext = buildMarketingManagerPerformanceContext(productionSnapshots);

  const confirmedMetrics = [...brief.confirmedMetrics];
  for (const snapshot of productionSnapshots) {
    for (const [metricType, value] of Object.entries(snapshot.metrics)) {
      if (value == null || !Number.isFinite(value)) continue;
      confirmedMetrics.push({
        metricType: `manual_${snapshot.platform}_${metricType}`,
        value,
        source: `content_performance_snapshot:${snapshot.snapshotId}`,
      });
    }
  }

  const managerEvidence = [
    ...brief.managerEvidence,
    ...analyst.evidenceLines.slice(0, 10),
    ...mmContext.recentStrongThemes.map((theme) => `strong_theme:${theme}`),
    ...mmContext.recentWeakThemes.map((theme) => `weak_theme:${theme}`),
    `human_edited_posts:${mmContext.humanEditedAttribution.humanEdited}`,
    `ai_unchanged_posts:${mmContext.humanEditedAttribution.aiUnchanged}`,
  ];

  const missingItems = [...brief.missingItems];
  if (
    productionSnapshots.every(
      (s) => s.collectionStatus !== "success" && s.collectionStatus !== "partial",
    )
  ) {
    missingItems.push("Manual publication metrics unavailable (read-only adapters not live)");
  }

  const sourcesChecked = [...brief.sourcesChecked, "marketing_content_performance_snapshots"];

  const dataAvailability =
    confirmedMetrics.length > brief.confirmedMetrics.length
      ? missingItems.length > brief.missingItems.length
        ? "partial"
        : "available"
      : brief.dataAvailability;

  return {
    ...brief,
    sourcesChecked,
    confirmedMetrics,
    missingItems,
    managerEvidence,
    dataAvailability,
  };
}
