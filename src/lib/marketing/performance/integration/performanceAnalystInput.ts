import type { ContentPerformanceSnapshot } from "@/lib/marketing/performance/types";
import {
  buildPerformanceAnalystEvidenceLines,
  buildPerformanceEvidenceFromSnapshots,
} from "@/lib/marketing/performance/memory/performanceEvidence";

export type PerformanceAnalystSnapshotInput = {
  snapshots: ContentPerformanceSnapshot[];
};

export function buildPerformanceAnalystInput(input: PerformanceAnalystSnapshotInput): {
  evidenceLines: string[];
  strongThemes: string[];
  weakThemes: string[];
  humanEditedCount: number;
  aiUnchangedCount: number;
  sampleQualityNotes: string[];
} {
  const evidence = buildPerformanceEvidenceFromSnapshots(input.snapshots);
  const evidenceLines = buildPerformanceAnalystEvidenceLines(evidence);

  const strongThemes: string[] = [];
  const weakThemes: string[] = [];
  const sampleQualityNotes: string[] = [];
  let humanEditedCount = 0;
  let aiUnchangedCount = 0;

  for (const row of evidence) {
    if (row.contentOrigin === "human_edited") humanEditedCount += 1;
    else aiUnchangedCount += 1;
    if (row.sampleQuality) sampleQualityNotes.push(row.sampleQuality);
    if (row.uncertaintyNotes.length) sampleQualityNotes.push(...row.uncertaintyNotes);

    const engagement = row.normalizedMetrics?.engagementRate;
    if (engagement != null && engagement >= 0.05 && row.topic) {
      strongThemes.push(row.topic);
    } else if (engagement != null && engagement < 0.02 && row.topic) {
      weakThemes.push(row.topic);
    }
  }

  return {
    evidenceLines,
    strongThemes,
    weakThemes,
    humanEditedCount,
    aiUnchangedCount,
    sampleQualityNotes,
  };
}
