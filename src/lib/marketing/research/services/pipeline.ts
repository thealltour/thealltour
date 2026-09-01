import {
  assertAgendaCandidateNotFinalDecision,
  buildAgendaCandidateFromBrief,
  rankAgendaCandidates,
} from "@/lib/marketing/research/services/agendaCandidateBuilder";
import {
  assertResearchBriefNotContentDraft,
  buildResearchBriefFromCluster,
} from "@/lib/marketing/research/services/briefBuilder";
import { deduplicateSignals } from "@/lib/marketing/research/services/deduplicator";
import { enrichResearchSignal } from "@/lib/marketing/research/services/enrichSignal";
import {
  normalizeResearchSignal,
  type NormalizeSignalResult,
} from "@/lib/marketing/research/services/normalizer";
import {
  runSemanticDedup,
  type SemanticDedupMetrics,
} from "@/lib/marketing/research/services/semanticDeduplicator";
import { groupSignalsByCluster } from "@/lib/marketing/research/services/researchCluster";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type {
  RawResearchSignalInput,
  ResearchSignal,
} from "@/lib/marketing/research/types/researchSignal";
import type { EmbeddingProvider } from "@/lib/marketing/semantic/types";
import type { SemanticDedupPolicy } from "@/lib/marketing/research/services/semanticDedupPolicy";

export type ResearchPipelineResult = {
  normalized: ResearchSignal[];
  rejected: Array<{ reason: string; input: RawResearchSignalInput }>;
  enriched: ResearchSignal[];
  duplicates: ResearchSignal[];
  briefs: ResearchBrief[];
  agendaCandidates: AgendaCandidate[];
  semanticMetrics?: SemanticDedupMetrics;
};

export type ResearchPipelineSemanticDeps = {
  provider?: EmbeddingProvider | null;
  policy?: SemanticDedupPolicy;
};

async function resolveSource(
  repo: ResearchRepository,
  sourceId: string,
  cache: Map<string, ResearchSource>,
): Promise<ResearchSource | null> {
  const cached = cache.get(sourceId);
  if (cached) return cached;
  const sync = repo.getSourceByIdSync?.(sourceId);
  if (sync) {
    cache.set(sourceId, sync);
    return sync;
  }
  const source = await repo.getSourceById(sourceId);
  if (source) cache.set(sourceId, source);
  return source;
}

export async function runResearchPipeline(input: {
  repo: ResearchRepository;
  rawSignals: RawResearchSignalInput[];
  now?: Date;
  semantic?: ResearchPipelineSemanticDeps;
}): Promise<ResearchPipelineResult> {
  const now = input.now ?? new Date();
  const sourceCache = new Map<string, ResearchSource>();
  const normalized: ResearchSignal[] = [];
  const rejected: ResearchPipelineResult["rejected"] = [];

  for (const raw of input.rawSignals) {
    const source = await resolveSource(input.repo, raw.sourceId, sourceCache);
    if (!source) {
      rejected.push({ reason: "unknown_source", input: raw });
      continue;
    }
    const result: NormalizeSignalResult = normalizeResearchSignal(raw, source, now);
    if (!result.ok) {
      rejected.push({ reason: result.reason, input: raw });
      continue;
    }
    const persisted = await input.repo.upsertSignal(result.signal);
    normalized.push(persisted);
  }

  const enrichedPreDedup: ResearchSignal[] = [];
  for (const signal of normalized) {
    const source = await resolveSource(input.repo, signal.sourceId, sourceCache);
    if (!source) {
      enrichedPreDedup.push(signal);
      continue;
    }
    enrichedPreDedup.push(enrichResearchSignal(signal, source, now));
  }

  const { unique: l2Unique, duplicates: l2Duplicates } = deduplicateSignals(enrichedPreDedup);
  const allDuplicates: ResearchSignal[] = [...l2Duplicates];

  const semanticResult = await runSemanticDedup({
    signals: l2Unique,
    sources: sourceCache,
    provider: input.semantic?.provider ?? null,
    policy: input.semantic?.policy,
    now,
  });

  allDuplicates.push(...semanticResult.duplicates);
  for (const dup of allDuplicates) {
    await input.repo.upsertSignal(dup);
  }

  const enriched: ResearchSignal[] = [];
  for (const signal of semanticResult.unique) {
    const source = await resolveSource(input.repo, signal.sourceId, sourceCache);
    if (!source) {
      enriched.push(signal);
      continue;
    }
    const next = enrichResearchSignal({ ...signal, status: "enriched" }, source, now);
    enriched.push(next);
  }

  for (const dup of semanticResult.duplicates) {
    enriched.push(dup);
  }

  for (const signal of enriched.filter((s) => s.status !== "duplicate")) {
    await input.repo.upsertSignal(signal);
  }

  const briefs: ResearchBrief[] = [];
  const grouped = groupSignalsByCluster(
    [...enriched, ...semanticResult.duplicates],
    semanticResult.clusters,
  );

  for (const cluster of semanticResult.clusters) {
    const clusterSignals = grouped.get(cluster.id) ?? [];
    const brief = buildResearchBriefFromCluster({
      cluster,
      signals: clusterSignals,
      sources: sourceCache,
      now,
    });
    if (!brief) continue;
    assertResearchBriefNotContentDraft(brief);
    await input.repo.upsertBrief(brief);
    briefs.push(brief);
  }

  const agendaCandidates: AgendaCandidate[] = [];
  const priorBriefs: ResearchBrief[] = [];
  for (const brief of briefs) {
    const candidate = buildAgendaCandidateFromBrief(brief, now, priorBriefs);
    assertAgendaCandidateNotFinalDecision(candidate);
    await input.repo.upsertAgendaCandidate(candidate);
    agendaCandidates.push(candidate);
    priorBriefs.push(brief);
  }

  return {
    normalized,
    rejected,
    enriched: enriched.filter((s) => s.status !== "duplicate"),
    duplicates: allDuplicates,
    briefs,
    agendaCandidates: rankAgendaCandidates(agendaCandidates),
    semanticMetrics: semanticResult.metrics,
  };
}

export async function createResearchPipelineSemanticDeps(input?: {
  env?: NodeJS.ProcessEnv | Record<string, string | undefined>;
}): Promise<ResearchPipelineSemanticDeps> {
  const env = input?.env ?? process.env;
  try {
    const { createEmbeddingProvider } = await import("@/lib/marketing/semantic/embeddingProvider");
    return { provider: createEmbeddingProvider(env) };
  } catch {
    return { provider: null };
  }
}
