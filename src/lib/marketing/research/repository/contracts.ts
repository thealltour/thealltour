import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

export interface ResearchSourceRegistry {
  getSourceById(id: string): Promise<ResearchSource | null>;
  listEnabledSources(): Promise<ResearchSource[]>;
  upsertSource(source: ResearchSource): Promise<ResearchSource>;
}

export interface ResearchSignalRepository {
  upsertSignal(signal: ResearchSignal): Promise<ResearchSignal>;
  findSignalById(id: string): Promise<ResearchSignal | null>;
  findByFingerprint(fingerprint: string): Promise<ResearchSignal | null>;
  findRecentSignals(input: { since: string; limit?: number }): Promise<ResearchSignal[]>;
  findEligibleSignals(input?: { limit?: number }): Promise<ResearchSignal[]>;
  findSignalsByTopic(topic: string, limit?: number): Promise<ResearchSignal[]>;
  findSignalsByDestination(destination: string, limit?: number): Promise<ResearchSignal[]>;
}

export interface ResearchBriefRepository {
  upsertBrief(brief: ResearchBrief): Promise<ResearchBrief>;
  findBriefById(id: string): Promise<ResearchBrief | null>;
  findActiveBriefs(limit?: number): Promise<ResearchBrief[]>;
}

export interface AgendaCandidateRepository {
  upsertAgendaCandidate(candidate: AgendaCandidate): Promise<AgendaCandidate>;
  findAgendaCandidateById(id: string): Promise<AgendaCandidate | null>;
  findRecentAgendaCandidates(input: { since: string; limit?: number }): Promise<AgendaCandidate[]>;
}

export type ResearchRepository = ResearchSourceRegistry &
  ResearchSignalRepository &
  ResearchBriefRepository &
  AgendaCandidateRepository & {
    /** Optional sync accessor for in-process pipeline (in-memory repo only). */
    getSourceByIdSync?(id: string): ResearchSource | null;
  };

export interface ResearchFreshnessScorer {
  score(signal: ResearchSignal): import("@/lib/marketing/research/types/researchSignal").FreshnessMetadata;
}

export interface ResearchCredibilityScorer {
  score(
    signal: ResearchSignal,
    source: ResearchSource,
  ): import("@/lib/marketing/research/types/researchSignal").CredibilityAssessment;
}

export interface ResearchRelevanceScorer {
  score(signal: ResearchSignal): import("@/lib/marketing/research/types/researchSignal").TravelRelevanceAssessment;
}

export interface ResearchSignalNormalizer {
  normalize(
    input: import("@/lib/marketing/research/types/researchSignal").RawResearchSignalInput,
    source: ResearchSource,
  ): import("@/lib/marketing/research/services/normalizer").NormalizeSignalResult;
}

export interface ResearchDeduplicator {
  deduplicate(signals: ResearchSignal[]): {
    unique: ResearchSignal[];
    duplicates: ResearchSignal[];
  };
}

export interface ResearchBriefBuilder {
  buildFromSignals(signals: ResearchSignal[]): ResearchBrief | null;
}

export interface AgendaCandidateBuilder {
  buildFromBrief(brief: ResearchBrief): AgendaCandidate;
}

/** Future hook: internal corpus via existing semantic retrieval. */
export interface InternalResearchCorpusAdapter {
  search(input: {
    query: string;
    limit?: number;
  }): Promise<Array<{ sourceId: string; excerpt: string; reference: string }>>;
}

/** Future hook: performance-derived signal ingestion. */
export interface PerformanceSignalAdapter {
  loadNormalizedSignals(input: { since: string }): Promise<
    import("@/lib/marketing/research/types/researchSignal").RawResearchSignalInput[]
  >;
}
