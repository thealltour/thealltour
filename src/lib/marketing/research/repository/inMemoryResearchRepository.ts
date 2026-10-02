import type {
  AgendaCandidateArticleRef,
  ResearchRepository,
} from "@/lib/marketing/research/repository/contracts";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";
import type { ResearchEvidence, ResearchSignal } from "@/lib/marketing/research/types/researchSignal";

export class InMemoryResearchRepository implements ResearchRepository {
  private sources = new Map<string, ResearchSource>();
  private signals = new Map<string, ResearchSignal>();
  private briefs = new Map<string, ResearchBrief>();
  private candidates = new Map<string, AgendaCandidate>();

  seedSources(sources: ResearchSource[]): void {
    for (const source of sources) {
      this.sources.set(source.id, source);
    }
  }

  getSourceByIdSync(id: string): ResearchSource | null {
    return this.sources.get(id) ?? null;
  }

  async getSourceById(id: string): Promise<ResearchSource | null> {
    return this.getSourceByIdSync(id);
  }

  async listEnabledSources(): Promise<ResearchSource[]> {
    return [...this.sources.values()].filter((s) => s.isEnabled);
  }

  async upsertSource(source: ResearchSource): Promise<ResearchSource> {
    this.sources.set(source.id, source);
    return source;
  }

  async upsertSignal(signal: ResearchSignal): Promise<ResearchSignal> {
    const existing = await this.findByFingerprint(signal.rawFingerprint);
    if (existing) {
      const merged: ResearchSignal = {
        ...existing,
        ...signal,
        id: existing.id,
        createdAt: existing.createdAt,
        observedAt: signal.observedAt,
        updatedAt: new Date().toISOString(),
        evidence: mergeEvidence(existing.evidence, signal.evidence),
      };
      this.signals.set(existing.id, merged);
      return merged;
    }
    this.signals.set(signal.id, signal);
    return signal;
  }

  async findSignalById(id: string): Promise<ResearchSignal | null> {
    return this.signals.get(id) ?? null;
  }

  async findByFingerprint(fingerprint: string): Promise<ResearchSignal | null> {
    for (const signal of this.signals.values()) {
      if (
        signal.rawFingerprint === fingerprint ||
        signal.normalizedFingerprint === fingerprint
      ) {
        return signal;
      }
    }
    return null;
  }

  async findRecentSignals(input: {
    since: string;
    limit?: number;
  }): Promise<ResearchSignal[]> {
    const sinceMs = new Date(input.since).getTime();
    const rows = [...this.signals.values()]
      .filter((s) => new Date(s.observedAt).getTime() >= sinceMs)
      .sort((a, b) => b.observedAt.localeCompare(a.observedAt));
    return rows.slice(0, input.limit ?? 100);
  }

  async findEligibleSignals(input?: { limit?: number }): Promise<ResearchSignal[]> {
    const rows = [...this.signals.values()].filter((s) => s.status === "eligible");
    return rows.slice(0, input?.limit ?? 100);
  }

  async findSignalsByTopic(topic: string, limit = 50): Promise<ResearchSignal[]> {
    const needle = topic.toLowerCase();
    return [...this.signals.values()]
      .filter((s) => s.topics.some((t) => t.toLowerCase().includes(needle)))
      .slice(0, limit);
  }

  async findSignalsByDestination(destination: string, limit = 50): Promise<ResearchSignal[]> {
    const needle = destination.toLowerCase();
    return [...this.signals.values()]
      .filter((s) => s.destinations.some((d) => d.toLowerCase() === needle))
      .slice(0, limit);
  }

  async upsertBrief(brief: ResearchBrief): Promise<ResearchBrief> {
    this.briefs.set(brief.id, brief);
    return brief;
  }

  async findBriefById(id: string): Promise<ResearchBrief | null> {
    return this.briefs.get(id) ?? null;
  }

  async findActiveBriefs(limit = 50): Promise<ResearchBrief[]> {
    return [...this.briefs.values()]
      .filter((b) => b.status === "active")
      .slice(0, limit);
  }

  async upsertAgendaCandidate(candidate: AgendaCandidate): Promise<AgendaCandidate> {
    this.candidates.set(candidate.id, candidate);
    return candidate;
  }

  async findAgendaCandidateById(id: string): Promise<AgendaCandidate | null> {
    return this.candidates.get(id) ?? null;
  }

  async findRecentAgendaCandidates(input: {
    since: string;
    limit?: number;
  }): Promise<AgendaCandidate[]> {
    const sinceMs = new Date(input.since).getTime();
    return [...this.candidates.values()]
      .filter((c) => new Date(c.createdAt).getTime() >= sinceMs)
      .sort(
        (a, b) =>
          b.compositeResearchScore - a.compositeResearchScore ||
          b.createdAt.localeCompare(a.createdAt),
      )
      .slice(0, input.limit ?? 100);
  }

  async findRecentAgendaCandidatesPage(input: {
    since: string;
    limit: number;
    offset: number;
  }): Promise<AgendaCandidate[]> {
    const sinceMs = new Date(input.since).getTime();
    const offset = Math.max(0, Math.floor(input.offset));
    const limit = Math.max(1, Math.floor(input.limit));
    return [...this.candidates.values()]
      .filter((c) => new Date(c.createdAt).getTime() >= sinceMs)
      .sort(
        (a, b) =>
          b.compositeResearchScore - a.compositeResearchScore ||
          b.createdAt.localeCompare(a.createdAt) ||
          (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
      )
      .slice(offset, offset + limit);
  }

  async findAgendaCandidateArticleRefs(
    candidates: Array<Pick<AgendaCandidate, "id" | "researchBriefId">>,
  ): Promise<Map<string, AgendaCandidateArticleRef>> {
    const refs = new Map<string, AgendaCandidateArticleRef>();
    for (const candidate of candidates) {
      const brief = this.briefs.get(candidate.researchBriefId);
      const signalId = brief?.primarySignalId ?? brief?.signalIds[0] ?? null;
      const signal = signalId ? this.signals.get(signalId) : undefined;
      refs.set(candidate.id, {
        signalId,
        canonicalUrl: signal?.canonicalUrl ?? null,
        sourceId: signal?.sourceId ?? null,
      });
    }
    return refs;
  }

  async deleteAgendaCandidateById(id: string): Promise<void> {
    this.candidates.delete(id);
  }

  async deleteBriefById(id: string): Promise<void> {
    this.briefs.delete(id);
  }

  async deleteSignalById(id: string): Promise<void> {
    this.signals.delete(id);
  }
}

function mergeEvidence(existing: ResearchEvidence[], incoming: ResearchEvidence[]): ResearchEvidence[] {
  const byId = new Map(existing.map((row) => [row.id, row]));
  for (const row of incoming) {
    byId.set(row.id, row);
  }
  return [...byId.values()];
}

export function createInMemoryResearchRepository(
  sources: ResearchSource[] = [],
): InMemoryResearchRepository {
  const repo = new InMemoryResearchRepository();
  repo.seedSources(sources);
  return repo;
}
