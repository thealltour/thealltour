/**
 * Process NEW travel_trends_staging rows → ResearchBrief via TrendSourceAdapter.
 * Item failures must never block the 09:00 Agenda pipeline.
 */

import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import {
  adaptTrendSignalToResearch,
  persistAdaptedTrend,
} from "@/lib/marketing/trends/adapter/trendSourceAdapter";
import type { TravelTrendsStagingRepository } from "@/lib/marketing/trends/staging/types";

export type TrendStagingProcessDiagnostics = {
  availableTrendCount: number;
  adaptedTrendCount: number;
  failedCount: number;
  discardedCount: number;
  researchBriefIds: string[];
  failures: Array<{ stagingId: string; observationId: string; reason: string }>;
  degradeReason: string | null;
};

export async function processNewTrendStagingObservations(input: {
  stagingRepo: TravelTrendsStagingRepository;
  researchRepo: ResearchRepository;
  limit?: number;
  now?: Date;
}): Promise<TrendStagingProcessDiagnostics> {
  const now = input.now ?? new Date();
  const diagnostics: TrendStagingProcessDiagnostics = {
    availableTrendCount: 0,
    adaptedTrendCount: 0,
    failedCount: 0,
    discardedCount: 0,
    researchBriefIds: [],
    failures: [],
    degradeReason: null,
  };

  let rows;
  try {
    rows = await input.stagingRepo.getNewTrendObservations(input.limit ?? 40);
  } catch (error) {
    diagnostics.degradeReason =
      error instanceof Error ? error.message : "trend_staging_list_failed";
    return diagnostics;
  }

  diagnostics.availableTrendCount = rows.length;
  if (rows.length === 0) {
    return diagnostics;
  }

  for (const row of rows) {
    try {
      const adapted = adaptTrendSignalToResearch(row.payload, now);
      const persisted = await persistAdaptedTrend(adapted, input.researchRepo);
      await input.stagingRepo.markTrendObservationIngested(row.id, now.toISOString());
      diagnostics.adaptedTrendCount += 1;
      diagnostics.researchBriefIds.push(persisted.brief.id);
    } catch (error) {
      diagnostics.failedCount += 1;
      const reason = error instanceof Error ? error.message : "adapt_or_persist_failed";
      diagnostics.failures.push({
        stagingId: row.id,
        observationId: row.observationId,
        reason: reason.slice(0, 240),
      });
      try {
        await input.stagingRepo.markTrendObservationDiscarded(
          row.id,
          `adapter_failed:${reason.slice(0, 180)}`,
          now.toISOString(),
        );
        diagnostics.discardedCount += 1;
      } catch {
        // Keep row as new for retry; do not throw.
      }
    }
  }

  if (diagnostics.failedCount > 0 && diagnostics.adaptedTrendCount === 0) {
    diagnostics.degradeReason = "all_trend_adaptations_failed";
  } else if (diagnostics.failedCount > 0) {
    diagnostics.degradeReason = "partial_trend_adaptation_failures";
  }

  return diagnostics;
}
