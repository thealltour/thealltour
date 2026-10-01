import type { AgendaCandidateEligibility } from "@/lib/marketing/research/manager/collectUniqueArticleAgendaCandidates";
import type {
  AgendaCandidateArticleRef,
  ResearchRepository,
} from "@/lib/marketing/research/repository/contracts";
import { canSourceParticipateInMm } from "@/lib/marketing/research/sourceLifecycle";
import type { AgendaCandidate } from "@/lib/marketing/research/types/researchBrief";
import type { ResearchSource } from "@/lib/marketing/research/types/researchSource";

/** Primary-source eligibility is fail-closed, including missing rows and lookup failures. */
export function createMmSourceLifecycleEligibility(
  repo: ResearchRepository,
  sourceCache: Map<string, ResearchSource | null> = new Map(),
): AgendaCandidateEligibility {
  const lookupSource = async (sourceId: string): Promise<ResearchSource | null> => {
    let source = sourceCache.get(sourceId);
    if (source === undefined) {
      source = await repo.getSourceById(sourceId);
      sourceCache.set(sourceId, source);
    }
    return source;
  };

  const resolvePrimarySourceId = async (
    candidate: AgendaCandidate,
    ref: AgendaCandidateArticleRef | undefined,
  ): Promise<string | null> => {
    if (ref?.sourceId) return ref.sourceId;
    const brief = await repo.findBriefById(candidate.researchBriefId);
    if (!brief) return null;
    const signalId = brief.primarySignalId ?? brief.signalIds[0] ?? null;
    const signal = signalId ? await repo.findSignalById(signalId) : null;
    return signal?.sourceId ?? brief.evidence[0]?.sourceId ?? null;
  };

  return async (candidate, ref) => {
    try {
      const sourceId = await resolvePrimarySourceId(candidate, ref);
      if (!sourceId) return false;
      return canSourceParticipateInMm(await lookupSource(sourceId));
    } catch {
      return false;
    }
  };
}
