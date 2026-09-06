import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import type { ResearchRepository } from "@/lib/marketing/research/repository/contracts";
import type { AgendaCandidate, ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import {
  buildAgendaCandidateContentHash,
  buildCompletedMarketingCandidateContentHash,
  buildResearchBriefContentHash,
} from "@/lib/marketing/semantic/entityEmbeddings/canonicalText";
import type {
  MarketingSemanticEntityType,
} from "@/lib/marketing/semantic/entityEmbeddings/types";

export type HydratedSemanticEntity = {
  entityType: MarketingSemanticEntityType;
  entityId: string;
  canonicalText: string;
  contentHash: string;
  sourceTextVersion: string;
};

export type SemanticEntityHydrationDeps = {
  researchRepo: Pick<ResearchRepository, "findBriefById" | "findAgendaCandidateById">;
  runRepo: Pick<DailyMarketingRunRepository, "findCandidateByCandidateId">;
  sourceTextVersion: string;
};

export type SemanticEntityHydrationResult =
  | { status: "ok"; entity: HydratedSemanticEntity }
  | { status: "unavailable"; reason: "not_found" | "empty_canonical_text"; message: string };

function fromResearchBrief(
  brief: ResearchBrief,
  sourceTextVersion: string,
): HydratedSemanticEntity {
  const built = buildResearchBriefContentHash({
    title: brief.title,
    summary: brief.summary,
    destinations: brief.destinations,
    topics: brief.topics,
    claims: brief.claims,
    practicalImplications: brief.openQuestions?.length
      ? brief.openQuestions
      : brief.risks?.slice(0, 4),
  });
  return {
    entityType: "research_brief",
    entityId: brief.id,
    canonicalText: built.canonicalText,
    contentHash: built.contentHash,
    sourceTextVersion,
  };
}

function fromAgendaCandidate(
  candidate: AgendaCandidate,
  brief: ResearchBrief | null,
  sourceTextVersion: string,
): HydratedSemanticEntity {
  const built = buildAgendaCandidateContentHash({
    title: candidate.title,
    summary: candidate.rationale,
    whyNow: candidate.scoreReasons?.[0] ?? null,
    koreanTravelerRelevance:
      candidate.koreanOutboundRelevanceScore != null
        ? `koreanOutboundRelevanceScore=${candidate.koreanOutboundRelevanceScore}`
        : null,
    practicalValue: candidate.scoreReasons?.[1] ?? null,
    theAllTourRelevance:
      candidate.commercialLinkageScore != null
        ? `commercialLinkageScore=${candidate.commercialLinkageScore}`
        : null,
    destinations: brief?.destinations,
    topics: brief?.topics,
  });
  return {
    entityType: "agenda_candidate",
    entityId: candidate.id,
    canonicalText: built.canonicalText,
    contentHash: built.contentHash,
    sourceTextVersion,
  };
}

function fromCompletedCandidate(
  candidate: CompletedMarketingCandidate,
  sourceTextVersion: string,
): HydratedSemanticEntity {
  const plan = candidate.contentPlan ?? candidate.draft.contentPlan ?? null;
  const facts = plan?.factsToUse ?? [];
  const built = buildCompletedMarketingCandidateContentHash({
    title: candidate.draft.title ?? candidate.selectedAgenda?.title ?? null,
    topic: candidate.draft.agenda ?? candidate.selectedAgenda?.title ?? null,
    channel: candidate.draft.channel,
    contentType: plan ? "planned_draft" : "draft",
    body: candidate.draft.body,
    keyClaims: facts,
  });
  return {
    entityType: "completed_marketing_candidate",
    entityId: candidate.candidateId,
    canonicalText: built.canonicalText,
    contentHash: built.contentHash,
    sourceTextVersion,
  };
}

export async function hydrateSemanticEntityForIndexing(
  input: { entityType: MarketingSemanticEntityType; entityId: string },
  deps: SemanticEntityHydrationDeps,
): Promise<SemanticEntityHydrationResult> {
  const entityId = input.entityId.trim();
  if (!entityId) {
    return {
      status: "unavailable",
      reason: "not_found",
      message: "entityId is empty",
    };
  }

  if (input.entityType === "research_brief") {
    const brief = await deps.researchRepo.findBriefById(entityId);
    if (!brief) {
      return {
        status: "unavailable",
        reason: "not_found",
        message: `research_brief not found: ${entityId}`,
      };
    }
    const entity = fromResearchBrief(brief, deps.sourceTextVersion);
    if (!entity.canonicalText.trim()) {
      return {
        status: "unavailable",
        reason: "empty_canonical_text",
        message: `research_brief ${entityId} produced empty canonical text`,
      };
    }
    return { status: "ok", entity };
  }

  if (input.entityType === "agenda_candidate") {
    const candidate = await deps.researchRepo.findAgendaCandidateById(entityId);
    if (!candidate) {
      return {
        status: "unavailable",
        reason: "not_found",
        message: `agenda_candidate not found: ${entityId}`,
      };
    }
    const brief = candidate.researchBriefId
      ? await deps.researchRepo.findBriefById(candidate.researchBriefId)
      : null;
    const entity = fromAgendaCandidate(candidate, brief, deps.sourceTextVersion);
    if (!entity.canonicalText.trim()) {
      return {
        status: "unavailable",
        reason: "empty_canonical_text",
        message: `agenda_candidate ${entityId} produced empty canonical text`,
      };
    }
    return { status: "ok", entity };
  }

  const candidate = await deps.runRepo.findCandidateByCandidateId(entityId);
  if (!candidate) {
    return {
      status: "unavailable",
      reason: "not_found",
      message: `completed_marketing_candidate not found: ${entityId}`,
    };
  }
  const entity = fromCompletedCandidate(candidate, deps.sourceTextVersion);
  if (!entity.canonicalText.trim()) {
    return {
      status: "unavailable",
      reason: "empty_canonical_text",
      message: `completed_marketing_candidate ${entityId} produced empty canonical text`,
    };
  }
  return { status: "ok", entity };
}
