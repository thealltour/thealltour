import type { PerformanceEvidence } from "@/lib/marketing/performance/types";
import type { ContentPerformanceSnapshot } from "@/lib/marketing/performance/types";
import { snapshotToPerformanceEvidence } from "@/lib/marketing/performance/observability";

export function buildPerformanceEvidenceFromSnapshots(
  snapshots: ContentPerformanceSnapshot[],
): PerformanceEvidence[] {
  return snapshots.map(snapshotToPerformanceEvidence);
}

export function buildPerformanceMemoryDocument(evidence: PerformanceEvidence): {
  title: string;
  body: string;
  metadata: Record<string, string | number | boolean | null>;
} {
  const metricsSummary = Object.entries(evidence.observedMetrics)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ");

  const uncertainty = evidence.uncertaintyNotes.join("; ");

  return {
    title: `Performance: ${evidence.topic ?? evidence.candidateId}`,
    body: [
      `channel=${evidence.channel}`,
      `contentOrigin=${evidence.contentOrigin}`,
      `collectionStatus=${evidence.collectionStatus}`,
      metricsSummary ? `metrics=${metricsSummary}` : "metrics=none",
      evidence.normalizedMetrics?.engagementRate != null
        ? `engagementRate=${evidence.normalizedMetrics.engagementRate}`
        : "engagementRate=unavailable",
      `uncertainty=${uncertainty}`,
    ].join("\n"),
    metadata: {
      candidateId: evidence.candidateId,
      reviewId: evidence.reviewId,
      channel: evidence.channel,
      contentOrigin: evidence.contentOrigin,
      collectionStatus: evidence.collectionStatus,
      sampleQuality: evidence.sampleQuality ?? "unknown",
      productLinked: evidence.productLinked,
    },
  };
}

export function buildPerformanceAnalystEvidenceLines(evidence: PerformanceEvidence[]): string[] {
  return evidence.map((row) => {
    const metrics = Object.entries(row.observedMetrics)
      .filter(([, v]) => v != null)
      .map(([k, v]) => `${k}:${v}`)
      .join(",");
    return [
      `topic=${row.topic ?? "unknown"}`,
      `channel=${row.channel}`,
      `origin=${row.contentOrigin}`,
      `status=${row.collectionStatus}`,
      metrics ? `metrics=${metrics}` : "metrics=absent",
      `uncertainty=${row.uncertaintyNotes.join("|")}`,
    ].join(" ");
  });
}
