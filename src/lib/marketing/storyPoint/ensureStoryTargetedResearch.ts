/**
 * ED-2 — StoryPoint-targeted RA-1 orchestration (primary + optional alternate).
 * Does not rerun Story Miner; shares paid-search budget across attempts.
 */

import type { ManagerToContentHandoffResult } from "@/lib/marketing/content/types";
import type {
  CompactManagerAgendaCandidate,
  CompactManagerResearchBrief,
} from "@/lib/marketing/research/manager/types";
import type { MarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import type { ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
import {
  ensureAudienceContentResearch,
  type AcrbLlmInvoke,
} from "@/lib/marketing/audienceResearch/ensureAudienceContentResearch";
import type { ExternalResearchBundle } from "@/lib/marketing/audienceResearch/external/runExternalResearch";
import type { ResearchSearchProvider } from "@/lib/marketing/audienceResearch/external/searchProvider";
import type { SourceSearchCache } from "@/lib/marketing/assets/shortform/resolver/searchCache";
import type {
  DurableStoryPointCandidateSet,
  EvidenceBackedStoryBrief,
  StoryResearchSkipReason,
} from "@/lib/marketing/storyPoint/contracts";
import {
  STORY_RESEARCH_MAX_QUERIES_PER_STORY,
  STORY_RESEARCH_MAX_STORYPOINTS_PER_AGENDA,
  STORY_RESEARCH_MAX_TOTAL_SEARCH_REQUESTS,
} from "@/lib/marketing/storyPoint/contracts";
import { storyEvidenceAllowsContentStrategy } from "@/lib/marketing/storyPoint/evaluateStoryPointQuality";
import { createStoryPointHash } from "@/lib/marketing/storyPoint/hash";

export type EnsureStoryTargetedResearchInput = {
  handoff: ManagerToContentHandoffResult;
  logicalRunKey: string;
  productionRequestRepo: MarketingProductionRequestRepository;
  candidateSet: DurableStoryPointCandidateSet;
  compactBrief?: CompactManagerResearchBrief | null;
  compactCandidate?: CompactManagerAgendaCandidate | null;
  forceRegenerate?: boolean;
  invoke?: AcrbLlmInvoke | null;
  now?: Date;
  loadFullResearchBrief?: (id: string) => Promise<ResearchBrief | null>;
  listRecentCandidateTitles?: () => Promise<Array<{ id: string; title: string }>>;
  cooledIdentity?: boolean;
  semanticAvailable?: boolean;
  searchProvider?: ResearchSearchProvider | null;
  searchCache?: SourceSearchCache | null;
  skipExternalResearch?: boolean;
  externalResearch?: ExternalResearchBundle | null;
  fetchImpl?: typeof fetch;
  /** Override shared budget (default STORY_RESEARCH_MAX_TOTAL_SEARCH_REQUESTS). */
  remainingSearchBudget?: number;
};

export type EnsureStoryTargetedResearchResult = {
  brief: AudienceContentResearchBrief | null;
  evidenceBackedStoryBrief: EvidenceBackedStoryBrief | null;
  storyResearchCanProceed: boolean;
  storyResearchSkipReason: StoryResearchSkipReason | null;
  externalSearchRequestCount: number;
  alternateFallbackUsed: boolean;
  selectedStoryPointId: string | null;
  selectedStoryPointHash: string | null;
  reused: boolean;
  persisted: boolean;
};

type StoryAttempt = {
  pointId: string;
  hash: string;
  isAlternate: boolean;
};

function resolveStoryAttempts(candidateSet: DurableStoryPointCandidateSet): StoryAttempt[] {
  const attempts: StoryAttempt[] = [];
  const primaryId = candidateSet.primaryStoryPointId;
  if (!primaryId || !candidateSet.primaryStoryPointHash) return attempts;

  attempts.push({
    pointId: primaryId,
    hash: candidateSet.primaryStoryPointHash,
    isAlternate: false,
  });

  if (attempts.length >= STORY_RESEARCH_MAX_STORYPOINTS_PER_AGENDA) return attempts;

  const alternateId = candidateSet.alternateStoryPointIds[0];
  if (!alternateId) return attempts;

  const alternate = candidateSet.candidates.find((c) => c.pointId === alternateId);
  if (!alternate) return attempts;

  attempts.push({
    pointId: alternateId,
    hash: createStoryPointHash(alternate),
    isAlternate: true,
  });

  return attempts;
}

function skipReasonFromVerdict(
  verdict: EvidenceBackedStoryBrief["storySupportVerdict"] | null | undefined,
): StoryResearchSkipReason {
  if (verdict === "REFUTED") return "story_point_refuted";
  if (verdict === "INSUFFICIENT_EVIDENCE") return "story_point_insufficient_evidence";
  return "story_point_research_failed";
}

export async function ensureStoryTargetedResearch(
  input: EnsureStoryTargetedResearchInput,
): Promise<EnsureStoryTargetedResearchResult> {
  const attempts = resolveStoryAttempts(input.candidateSet);
  if (attempts.length === 0) {
    return {
      brief: null,
      evidenceBackedStoryBrief: null,
      storyResearchCanProceed: false,
      storyResearchSkipReason: "story_point_all_alternates_exhausted",
      externalSearchRequestCount: 0,
      alternateFallbackUsed: false,
      selectedStoryPointId: null,
      selectedStoryPointHash: null,
      reused: false,
      persisted: false,
    };
  }

  let remainingBudget =
    input.remainingSearchBudget ?? STORY_RESEARCH_MAX_TOTAL_SEARCH_REQUESTS;
  let externalSearchRequestCount = 0;
  let lastBrief: AudienceContentResearchBrief | null = null;
  let lastEvidenceBrief: EvidenceBackedStoryBrief | null = null;
  let lastSkipReason: StoryResearchSkipReason = "story_point_all_alternates_exhausted";
  let alternateFallbackUsed = false;
  let reused = false;
  let persisted = false;
  let selectedStoryPointId: string | null = null;
  let selectedStoryPointHash: string | null = null;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];
    if (remainingBudget <= 0) break;

    const storyPoint = input.candidateSet.candidates.find((c) => c.pointId === attempt.pointId);
    if (!storyPoint) continue;

    const result = await ensureAudienceContentResearch({
      handoff: input.handoff,
      logicalRunKey: input.logicalRunKey,
      productionRequestRepo: input.productionRequestRepo,
      compactBrief: input.compactBrief,
      compactCandidate: input.compactCandidate,
      forceRegenerate: input.forceRegenerate,
      invoke: input.invoke,
      now: input.now,
      loadFullResearchBrief: input.loadFullResearchBrief,
      listRecentCandidateTitles: input.listRecentCandidateTitles,
      cooledIdentity: input.cooledIdentity,
      semanticAvailable: input.semanticAvailable,
      searchProvider: input.searchProvider,
      searchCache: input.searchCache,
      skipExternalResearch: input.skipExternalResearch,
      externalResearch: input.externalResearch,
      fetchImpl: input.fetchImpl,
      storyPoint,
      storyPointHash: attempt.hash,
      alternateFallbackUsed: attempt.isAlternate,
      remainingSearchBudget: remainingBudget,
      maxQueries: STORY_RESEARCH_MAX_QUERIES_PER_STORY,
    });

    const used = result.externalSearchRequestCount ?? 0;
    externalSearchRequestCount += used;
    remainingBudget = Math.max(0, remainingBudget - used);
    lastBrief = result.brief;
    lastEvidenceBrief = result.evidenceBackedStoryBrief ?? result.brief.evidenceBackedStoryBrief ?? null;
    reused = result.reused;
    persisted = result.persisted || persisted;
    selectedStoryPointId = attempt.pointId;
    selectedStoryPointHash = attempt.hash;

    if (result.storyResearchCanProceed && lastEvidenceBrief) {
      return {
        brief: result.brief,
        evidenceBackedStoryBrief: lastEvidenceBrief,
        storyResearchCanProceed: true,
        storyResearchSkipReason: null,
        externalSearchRequestCount,
        alternateFallbackUsed: attempt.isAlternate,
        selectedStoryPointId,
        selectedStoryPointHash,
        reused,
        persisted,
      };
    }

    lastSkipReason =
      result.storyResearchSkipReason ??
      skipReasonFromVerdict(lastEvidenceBrief?.storySupportVerdict);

    const canTryAlternate =
      index === 0 &&
      attempts.length > 1 &&
      remainingBudget > 0 &&
      lastEvidenceBrief &&
      !storyEvidenceAllowsContentStrategy(lastEvidenceBrief.storySupportVerdict);

    if (canTryAlternate) {
      alternateFallbackUsed = true;
      continue;
    }
    break;
  }

  return {
    brief: lastBrief,
    evidenceBackedStoryBrief: lastEvidenceBrief,
    storyResearchCanProceed: false,
    storyResearchSkipReason: lastSkipReason,
    externalSearchRequestCount,
    alternateFallbackUsed,
    selectedStoryPointId,
    selectedStoryPointHash,
    reused,
    persisted,
  };
}
