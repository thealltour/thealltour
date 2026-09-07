/**
 * 09:00 Agenda preflight: NEW trends → adapt → research persist → bounded semantic ensure.
 * Failures degrade diagnostics only — Agenda continues on existing Research.
 */

import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import { createResearchRepository } from "@/lib/marketing/research/repository/createResearchRepository";
import { createEmbeddingProvider } from "@/lib/marketing/semantic/embeddingProvider";
import { createMarketingSemanticEmbeddingRepository } from "@/lib/marketing/semantic/entityEmbeddings/createSemanticEmbeddingRepository";
import { resolveMarketingSemanticIndexingConfig } from "@/lib/marketing/semantic/indexing/indexingConfig";
import { processNewTrendStagingObservations } from "@/lib/marketing/trends/staging/processNewTrendStaging";
import { createTravelTrendsStagingRepository } from "@/lib/marketing/trends/staging/createTravelTrendsStagingRepository";
import type { TravelTrendsStagingRepository } from "@/lib/marketing/trends/staging/types";
import {
  ensureSemanticCoverageForBriefs,
  type SemanticCoverageDiagnostics,
} from "@/lib/marketing/trends/semantic/ensureTrendSemanticCoverage";
import {
  buildTrendEditorialPlans,
  type TrendEditorialDiagnostics,
} from "@/lib/marketing/trends/editorial/trendEditorialPlanning";
import { resolveMarketingTrendEditorialMode } from "@/lib/marketing/trends/editorial/trendEditorialModeConfig";

export type TrendAgendaPreflightResult = {
  trendAdaptation: {
    availableTrendCount: number;
    adaptedTrendCount: number;
    failedCount: number;
    researchBriefIds: string[];
    degradeReason: string | null;
  };
  semanticCoverage: SemanticCoverageDiagnostics;
  editorial: TrendEditorialDiagnostics;
};

export type TrendAgendaPreflightDeps = {
  stagingRepo?: TravelTrendsStagingRepository;
  researchRepo?: ResearchRepository;
  runRepo?: Pick<DailyMarketingRunRepository, "findCandidateByCandidateId">;
  skipSemanticEnsure?: boolean;
  now?: Date;
};

export async function runTrendAgendaPreflight(
  deps: TrendAgendaPreflightDeps = {},
): Promise<TrendAgendaPreflightResult> {
  const mode = resolveMarketingTrendEditorialMode();
  const emptyEditorial: TrendEditorialDiagnostics = {
    mode,
    availableTrendCount: 0,
    adaptedTrendCount: 0,
    editorialSignalCount: 0,
    hypotheticalAppliedCount: 0,
    appliedCount: 0,
    degradeReason: null,
  };

  const emptyCoverage: SemanticCoverageDiagnostics = {
    eligibleCount: 0,
    availableCount: 0,
    indexedCount: 0,
    failedCount: 0,
    coverageRatio: 1,
    failureReasons: [],
    degradeReason: null,
  };

  let stagingRepo = deps.stagingRepo;
  let researchRepo = deps.researchRepo;
  try {
    stagingRepo = stagingRepo ?? (await createTravelTrendsStagingRepository());
    researchRepo = researchRepo ?? (await createResearchRepository());
  } catch (error) {
    const reason = error instanceof Error ? error.message : "trend_preflight_repo_init_failed";
    return {
      trendAdaptation: {
        availableTrendCount: 0,
        adaptedTrendCount: 0,
        failedCount: 0,
        researchBriefIds: [],
        degradeReason: reason,
      },
      semanticCoverage: { ...emptyCoverage, degradeReason: reason },
      editorial: { ...emptyEditorial, degradeReason: reason },
    };
  }

  // Always try to drain NEW staging → research (Meta missing/empty is fine).
  const adaptation = await processNewTrendStagingObservations({
    stagingRepo,
    researchRepo,
    now: deps.now,
  });

  let semanticCoverage = emptyCoverage;
  if (!deps.skipSemanticEnsure && adaptation.researchBriefIds.length > 0) {
    try {
      const config = resolveMarketingSemanticIndexingConfig();
      const embeddingRepo = await createMarketingSemanticEmbeddingRepository();
      const provider = createEmbeddingProvider();
      const runRepo =
        deps.runRepo ??
        ({
          findCandidateByCandidateId: async () => null,
        } as Pick<DailyMarketingRunRepository, "findCandidateByCandidateId">);

      semanticCoverage = await ensureSemanticCoverageForBriefs({
        researchBriefIds: adaptation.researchBriefIds,
        researchRepo,
        runRepo,
        embeddingRepo,
        provider,
        config,
        maxEnsure: 12,
      });
    } catch (error) {
      semanticCoverage = {
        ...emptyCoverage,
        eligibleCount: adaptation.researchBriefIds.length,
        failedCount: adaptation.researchBriefIds.length,
        degradeReason:
          error instanceof Error ? error.message : "semantic_coverage_init_failed",
        failureReasons: adaptation.researchBriefIds.map((id) => ({
          entityId: id,
          reason: "embedding_provider_unavailable",
        })),
      };
    }
  }

  const briefs = [];
  for (const id of adaptation.researchBriefIds.slice(0, 24)) {
    const brief = await researchRepo.findBriefById(id);
    if (brief) briefs.push(brief);
  }
  const editorialPlan = buildTrendEditorialPlans({
    briefs,
    availableTrendCount: adaptation.availableTrendCount,
    adaptedTrendCount: adaptation.adaptedTrendCount,
    mode,
    degradeReason: adaptation.degradeReason,
  });

  return {
    trendAdaptation: {
      availableTrendCount: adaptation.availableTrendCount,
      adaptedTrendCount: adaptation.adaptedTrendCount,
      failedCount: adaptation.failedCount,
      researchBriefIds: adaptation.researchBriefIds,
      degradeReason: adaptation.degradeReason,
    },
    semanticCoverage,
    editorial: editorialPlan.diagnostics,
  };
}
