import type { ContentPerformanceSnapshot } from "@/lib/marketing/performance/types";
import { buildPerformanceAnalystInput } from "@/lib/marketing/performance/integration/performanceAnalystInput";

export function buildMarketingManagerPerformanceContext(snapshots: ContentPerformanceSnapshot[]): {
  recentStrongThemes: string[];
  recentWeakThemes: string[];
  formatChannelObservations: string[];
  repetitionRiskNotes: string[];
  sampleQualityNotes: string[];
  humanEditedAttribution: { humanEdited: number; aiUnchanged: number };
  advisoryOnly: true;
} {
  const analyst = buildPerformanceAnalystInput({ snapshots });
  const formatChannelObservations = snapshots.map(
    (row) => `${row.channel}:${row.format ?? "unknown"}:${row.collectionStatus}`,
  );

  const repetitionRiskNotes =
    analyst.strongThemes.length === 1
      ? ["single_strong_theme_sample_not_repeat_winner"]
      : [];

  return {
    recentStrongThemes: analyst.strongThemes,
    recentWeakThemes: analyst.weakThemes,
    formatChannelObservations,
    repetitionRiskNotes,
    sampleQualityNotes: analyst.sampleQualityNotes,
    humanEditedAttribution: {
      humanEdited: analyst.humanEditedCount,
      aiUnchanged: analyst.aiUnchangedCount,
    },
    advisoryOnly: true,
  };
}
