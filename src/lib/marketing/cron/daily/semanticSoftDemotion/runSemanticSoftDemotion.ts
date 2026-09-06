import type { MarketingResearchContext } from "@/lib/marketing/research/manager/types";
import {
  createMarketingSemanticEmbeddingRepository,
  isMarketingSemanticEmbeddingRepositoryConfigured,
} from "@/lib/marketing/semantic/entityEmbeddings/createSemanticEmbeddingRepository";
import type { MarketingSemanticEmbeddingRepository } from "@/lib/marketing/semantic/entityEmbeddings/repository";
import type { EmbeddingVector } from "@/lib/marketing/semantic/types";
import { applySemanticDemotion } from "@/lib/marketing/cron/daily/semanticSoftDemotion/applySemanticDemotion";
import { computeSemanticDemotion } from "@/lib/marketing/cron/daily/semanticSoftDemotion/computeSemanticDemotion";
import {
  SEMANTIC_SOFT_DEMOTION_MODEL,
  SEMANTIC_SOFT_DEMOTION_REVISION,
  SEMANTIC_SOFT_DEMOTION_SOURCE_TEXT_VERSION,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/constants";
import {
  resolveMarketingSemanticDemotionMode,
  type MarketingSemanticDemotionMode,
} from "@/lib/marketing/cron/daily/semanticSoftDemotion/demotionModeConfig";
import type { SemanticSoftDemotionReport } from "@/lib/marketing/cron/daily/semanticSoftDemotion/types";

export type SemanticSoftDemotionDeps = {
  embeddingRepo?: MarketingSemanticEmbeddingRepository | null;
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
  /**
   * Explicit mode override (tests / callers).
   * When omitted, resolved from MARKETING_SEMANTIC_DEMOTION_MODE (default: shadow).
   */
  mode?: MarketingSemanticDemotionMode;
  /**
   * @deprecated Prefer mode: "shadow". When true and mode omitted, forces shadow.
   */
  shadowOnly?: boolean;
  /** Injected embedding map (tests / shadow). Skips repository load. */
  embeddingsByBriefId?: Map<string, EmbeddingVector>;
  loadError?: string | null;
};

export function resolveSemanticDemotionModeFromDeps(
  deps: SemanticSoftDemotionDeps,
): MarketingSemanticDemotionMode {
  if (deps.mode) return deps.mode;
  if (deps.shadowOnly) return "shadow";
  return resolveMarketingSemanticDemotionMode(deps.env ?? process.env);
}

function emptyOffReport(
  context: MarketingResearchContext,
  mode: MarketingSemanticDemotionMode,
): SemanticSoftDemotionReport {
  return {
    mode,
    semanticAvailable: false,
    degraded: false,
    degradeReason: null,
    model: SEMANTIC_SOFT_DEMOTION_MODEL,
    revision: SEMANTIC_SOFT_DEMOTION_REVISION,
    sourceTextVersion: SEMANTIC_SOFT_DEMOTION_SOURCE_TEXT_VERSION,
    embeddingsLoaded: 0,
    embeddingAvailableCount: 0,
    comparedCount: 0,
    demotedCount: 0,
    hypotheticalDemotedCount: 0,
    appliedDemotedCount: 0,
    decisions: context.agendaCandidates.map((c) => ({
      agendaCandidateId: c.agendaCandidateId,
      researchBriefId: c.researchBriefId,
      semanticAvailable: false,
      semanticSimilarity: null,
      comparedResearchBriefId: null,
      comparedAgendaCandidateId: null,
      semanticBand: null,
      contentCorroborators: [],
      contextSignals: [],
      deterministicExactSignals: [],
      duplicateSignals: [],
      demotionAmount: 0,
      demotionReason: null,
    })),
  };
}

async function loadEmbeddingsForBriefs(
  briefIds: string[],
  deps: SemanticSoftDemotionDeps,
): Promise<{ embeddings: Map<string, EmbeddingVector>; loadError: string | null }> {
  if (deps.embeddingsByBriefId) {
    return { embeddings: deps.embeddingsByBriefId, loadError: deps.loadError ?? null };
  }
  if (deps.loadError) {
    return { embeddings: new Map(), loadError: deps.loadError };
  }

  const env = deps.env ?? process.env;
  let repo = deps.embeddingRepo;
  if (repo === undefined) {
    if (!isMarketingSemanticEmbeddingRepositoryConfigured(env)) {
      return { embeddings: new Map(), loadError: null };
    }
    try {
      repo = await createMarketingSemanticEmbeddingRepository({
        backend: "supabase",
        env,
      });
    } catch (error) {
      return {
        embeddings: new Map(),
        loadError: error instanceof Error ? error.message : "embedding_repository_init_failed",
      };
    }
  }
  if (!repo) {
    return { embeddings: new Map(), loadError: null };
  }

  try {
    const rows = await repo.listByEntityIds({
      entityType: "research_brief",
      entityIds: briefIds,
      model: SEMANTIC_SOFT_DEMOTION_MODEL,
      revision: SEMANTIC_SOFT_DEMOTION_REVISION,
      sourceTextVersion: SEMANTIC_SOFT_DEMOTION_SOURCE_TEXT_VERSION,
    });
    const embeddings = new Map<string, EmbeddingVector>();
    for (const row of rows) {
      embeddings.set(row.entityId, row.embedding);
    }
    return { embeddings, loadError: null };
  } catch (error) {
    return {
      embeddings: new Map(),
      loadError: error instanceof Error ? error.message : "embedding_repository_query_failed",
    };
  }
}

/**
 * Load durable ResearchBrief embeddings (no Mini PC call) and compute soft demotion.
 * Activation:
 * - off: skip semantic work; preserve context
 * - shadow: compute diagnostics; do not mutate scores
 * - live: compute and apply bounded soft demotion
 */
export async function runSemanticSoftDemotion(
  context: MarketingResearchContext,
  deps: SemanticSoftDemotionDeps = {},
): Promise<{
  context: MarketingResearchContext;
  report: SemanticSoftDemotionReport;
  mode: MarketingSemanticDemotionMode;
  orderBefore: string[];
  orderAfter: string[];
  moved: Array<{ agendaCandidateId: string; from: number; to: number; demotionAmount: number }>;
}> {
  const mode = resolveSemanticDemotionModeFromDeps(deps);
  const orderBefore = context.agendaCandidates.map((c) => c.agendaCandidateId);

  if (mode === "off") {
    const report = emptyOffReport(context, mode);
    return {
      context,
      report,
      mode,
      orderBefore,
      orderAfter: orderBefore,
      moved: [],
    };
  }

  const briefIds = [
    ...new Set(context.agendaCandidates.map((c) => c.researchBriefId).filter(Boolean)),
  ];
  const { embeddings, loadError } = await loadEmbeddingsForBriefs(briefIds, deps);

  const report = computeSemanticDemotion({
    candidates: context.agendaCandidates,
    embeddingsByBriefId: embeddings,
    loadError,
    mode,
  });

  if (mode === "shadow") {
    const applied = applySemanticDemotion(context, report);
    return {
      context,
      report: {
        ...report,
        mode: "shadow",
        appliedDemotedCount: 0,
      },
      mode,
      orderBefore: applied.orderBefore,
      // Hypothetical re-order for diagnostics only — scores on context unchanged.
      orderAfter: applied.orderAfter,
      moved: applied.moved,
    };
  }

  // live
  const applied = applySemanticDemotion(context, report);
  return {
    context: applied.context,
    report: {
      ...report,
      mode: "live",
      appliedDemotedCount: report.hypotheticalDemotedCount,
    },
    mode,
    orderBefore: applied.orderBefore,
    orderAfter: applied.orderAfter,
    moved: applied.moved,
  };
}
