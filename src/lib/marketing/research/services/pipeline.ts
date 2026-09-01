import {
  assertAgendaCandidateNotFinalDecision,
  buildAgendaCandidateFromBrief,
} from "@/lib/marketing/research/services/agendaCandidateBuilder";
import {
  assertResearchBriefNotContentDraft,
  buildResearchBriefFromSignals,
} from "@/lib/marketing/research/services/briefBuilder";
import { deduplicateSignals } from "@/lib/marketing/research/services/deduplicator";
import { enrichResearchSignal } from "@/lib/marketing/research/services/enrichSignal";
import {
  normalizeResearchSignal,
  type NormalizeSignalResult,
} from "@/lib/marketing/research/services/normalizer";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type {
  RawResearchSignalInput,
  ResearchSignal,
} from "@/lib/marketing/research/types/researchSignal";

export type ResearchPipelineResult = {
  normalized: ResearchSignal[];
  rejected: Array<{ reason: string; input: RawResearchSignalInput }>;
  enriched: ResearchSignal[];
  duplicates: ResearchSignal[];
  briefs: ResearchBrief[];
  agendaCandidates: AgendaCandidate[];
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

  const { unique, duplicates } = deduplicateSignals(enrichedPreDedup);
  for (const dup of duplicates) {
    await input.repo.upsertSignal(dup);
  }

  const enriched: ResearchSignal[] = [];
  for (const signal of unique) {
    const source = await resolveSource(input.repo, signal.sourceId, sourceCache);
    if (!source) {
      enriched.push(signal);
      continue;
    }
    const next = enrichResearchSignal({ ...signal, status: "enriched" }, source, now);
    enriched.push(next);
  }

  for (const signal of enriched) {
    await input.repo.upsertSignal(signal);
  }

  const briefs: ResearchBrief[] = [];
  const agendaCandidates: AgendaCandidate[] = [];

  const eligible = enriched.filter((s) => s.status === "eligible");
  const byDestination = new Map<string, ResearchSignal[]>();
  for (const signal of eligible) {
    const key = signal.destinations[0] ?? signal.signalType;
    const list = byDestination.get(key) ?? [];
    list.push(signal);
    byDestination.set(key, list);
  }

  for (const group of byDestination.values()) {
    const brief = buildResearchBriefFromSignals(group, now);
    if (!brief) continue;
    assertResearchBriefNotContentDraft(brief);
    await input.repo.upsertBrief(brief);
    briefs.push(brief);

    const candidate = buildAgendaCandidateFromBrief(brief, now);
    assertAgendaCandidateNotFinalDecision(candidate);
    await input.repo.upsertAgendaCandidate(candidate);
    agendaCandidates.push(candidate);
  }

  return {
    normalized,
    rejected,
    enriched,
    duplicates,
    briefs,
    agendaCandidates,
  };
}
