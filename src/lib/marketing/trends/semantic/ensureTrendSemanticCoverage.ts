/**
 * T-8 bounded semantic coverage ensure before MM candidate pool entry.
 * Reuses E-2 indexSemanticEntitiesBatch — no new embedding subsystem.
 */

import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import type { MarketingSemanticEmbeddingRepository } from "@/lib/marketing/semantic/entityEmbeddings/repository";
import {
  indexSemanticEntitiesBatch,
  type SemanticIndexResult,
} from "@/lib/marketing/semantic/indexing/indexSemanticEntity";
import type { MarketingSemanticIndexingConfig } from "@/lib/marketing/semantic/indexing/indexingConfig";
import type { EmbeddingProvider } from "@/lib/marketing/semantic/types";

export type SemanticCoverageDiagnostics = {
  eligibleCount: number;
  availableCount: number;
  indexedCount: number;
  failedCount: number;
  coverageRatio: number;
  failureReasons: Array<{
    entityId: string;
    reason: "embedding_missing" | "embedding_provider_unavailable" | "unsupported_entity" | string;
  }>;
  degradeReason: string | null;
};

export type EnsureSemanticCoverageInput = {
  researchBriefIds: string[];
  researchRepo: Pick<ResearchRepository, "findBriefById" | "findAgendaCandidateById">;
  runRepo: Pick<DailyMarketingRunRepository, "findCandidateByCandidateId">;
  embeddingRepo: MarketingSemanticEmbeddingRepository | null;
  provider: EmbeddingProvider | null;
  config: MarketingSemanticIndexingConfig;
  /** Soft cap — never unbounded Mini PC calls on 09:00 path. */
  maxEnsure?: number;
};

function mapFailureReason(result: SemanticIndexResult): string {
  if (result.status === "unavailable") {
    if (/provider|EMBEDDING|unavailable/i.test(result.reason ?? result.message ?? "")) {
      return "embedding_provider_unavailable";
    }
    return result.reason ?? "embedding_missing";
  }
  if (result.status === "failed") {
    return result.reason ?? "embedding_missing";
  }
  return result.reason ?? "unknown";
}

export async function ensureSemanticCoverageForBriefs(
  input: EnsureSemanticCoverageInput,
): Promise<SemanticCoverageDiagnostics> {
  const maxEnsure = Math.max(0, Math.min(24, input.maxEnsure ?? 12));
  const eligible = [...new Set(input.researchBriefIds)].slice(0, maxEnsure);

  const diagnostics: SemanticCoverageDiagnostics = {
    eligibleCount: eligible.length,
    availableCount: 0,
    indexedCount: 0,
    failedCount: 0,
    coverageRatio: 0,
    failureReasons: [],
    degradeReason: null,
  };

  if (eligible.length === 0) {
    diagnostics.coverageRatio = 1;
    return diagnostics;
  }

  if (!input.embeddingRepo || !input.provider) {
    diagnostics.degradeReason = "embedding_provider_unavailable";
    diagnostics.failedCount = eligible.length;
    diagnostics.failureReasons = eligible.map((id) => ({
      entityId: id,
      reason: "embedding_provider_unavailable",
    }));
    return diagnostics;
  }

  try {
    const results = await indexSemanticEntitiesBatch(
      {
        entities: eligible.map((entityId) => ({
          entityType: "research_brief" as const,
          entityId,
        })),
      },
      {
        researchRepo: input.researchRepo,
        runRepo: input.runRepo,
        embeddingRepo: input.embeddingRepo,
        provider: input.provider,
        config: input.config,
      },
    );

    for (const result of results) {
      if (result.status === "indexed" || result.status === "skipped_unchanged") {
        diagnostics.indexedCount += 1;
        diagnostics.availableCount += 1;
      } else if (result.status === "dry_run") {
        diagnostics.availableCount += 1;
      } else {
        diagnostics.failedCount += 1;
        diagnostics.failureReasons.push({
          entityId: result.entityId,
          reason: mapFailureReason(result),
        });
      }
    }
  } catch (error) {
    diagnostics.degradeReason =
      error instanceof Error ? error.message : "semantic_coverage_ensure_failed";
    diagnostics.failedCount = eligible.length;
    diagnostics.failureReasons = eligible.map((id) => ({
      entityId: id,
      reason: "embedding_provider_unavailable",
    }));
  }

  diagnostics.coverageRatio =
    diagnostics.eligibleCount === 0
      ? 1
      : diagnostics.availableCount / diagnostics.eligibleCount;

  return diagnostics;
}
