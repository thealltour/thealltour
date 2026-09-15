import type { ManagerToContentHandoffResult } from "@/lib/marketing/content/types";
import type {
  CompactManagerAgendaCandidate,
  CompactManagerResearchBrief,
} from "@/lib/marketing/research/manager/types";
import type { MarketingProductionRequestRepository } from "@/lib/marketing/cron/daily/repository/createMarketingProductionRequestRepository";
import type { ResearchBrief } from "@/lib/marketing/research/types/researchBrief";
import type {
  AcrbContentAngle,
  AudienceContentResearchBrief,
} from "@/lib/marketing/audienceResearch/contracts";
import { gatherAcrbInputs } from "@/lib/marketing/audienceResearch/gatherInputs";
import {
  loadDurableAcrb,
  persistDurableAcrb,
  readAcrbFromProductionRequest,
} from "@/lib/marketing/audienceResearch/persistence";
import { synthesizeAudienceContentResearch, type AcrbLlmInvoke } from "@/lib/marketing/audienceResearch/synthesize";

export type { AcrbLlmInvoke };
import {
  buildAcrbId,
  buildAcrbLogicalIdentity,
  buildEvidenceFingerprint,
} from "@/lib/marketing/audienceResearch/validate";
import type { ResearchSearchProvider } from "@/lib/marketing/audienceResearch/external/searchProvider";
import {
  reconstructExternalBundleFromAcrb,
  runBoundedExternalResearch,
  type ExternalResearchBundle,
} from "@/lib/marketing/audienceResearch/external/runExternalResearch";
import type { SourceSearchCache } from "@/lib/marketing/assets/shortform/resolver/searchCache";
import {
  adjudicateStoryResearch,
  assertStoryResearchCanProceed,
} from "@/lib/marketing/storyPoint/adjudicateStoryResearch";
import { validateStoryResearchLock } from "@/lib/marketing/storyPoint/researchLock";
import type {
  EvidenceBackedStoryBrief,
  ResearchQuestionFinding,
  StoryContentPoint,
  StoryEvidenceSupportStatus,
  StoryResearchSkipReason,
} from "@/lib/marketing/storyPoint/contracts";
import {
  STORY_RESEARCH_CONTRACT_VERSION,
  STORY_RESEARCH_MAX_QUERIES_PER_STORY,
} from "@/lib/marketing/storyPoint/contracts";
import { deriveAgendaTopicIdentity } from "@/lib/marketing/audienceResearch/topicIdentity/deriveTopicIdentity";

export type EnsureAcrbInput = {
  handoff: ManagerToContentHandoffResult;
  logicalRunKey: string;
  productionRequestRepo: MarketingProductionRequestRepository;
  compactBrief?: CompactManagerResearchBrief | null;
  compactCandidate?: CompactManagerAgendaCandidate | null;
  forceRegenerate?: boolean;
  invoke?: AcrbLlmInvoke | null;
  now?: Date;
  loadFullResearchBrief?: (id: string) => Promise<ResearchBrief | null>;
  listRecentCandidateTitles?: () => Promise<Array<{ id: string; title: string }>>;
  cooledIdentity?: boolean;
  semanticAvailable?: boolean;
  /** Inject for tests / override; default resolves from env (fail-closed). */
  searchProvider?: ResearchSearchProvider | null;
  searchCache?: SourceSearchCache | null;
  /**
   * Skip network external research. When a durable ACRB already holds external
   * evidence, that bundle is reconstructed and reused (synthesis-only path).
   */
  skipExternalResearch?: boolean;
  /** Explicit external research override (tests / synthesis-only harness). */
  externalResearch?: ExternalResearchBundle | null;
  fetchImpl?: typeof fetch;
  /** ED-2 — StoryPoint-targeted research scope. */
  storyPoint?: StoryContentPoint | null;
  storyPointHash?: string | null;
  alternateFallbackUsed?: boolean;
  /** Remaining paid-search budget across agenda story attempts. */
  remainingSearchBudget?: number;
  maxQueries?: number;
  /** Test / harness overrides for adjudication. */
  verdictOverride?: StoryEvidenceSupportStatus | null;
  supportedClaimBoundaryOverride?: string | null;
  questionFindingsOverride?: ResearchQuestionFinding[] | null;
  /** When true (default for storyPoint), run post-adjudication identity lock. */
  validateResearchLock?: boolean;
};

export type EnsureAcrbResult = {
  brief: AudienceContentResearchBrief;
  reused: boolean;
  persisted: boolean;
  /** True when prior durable external evidence was reconstructed (no new search). */
  externalResearchReused?: boolean;
  /** ED-2 — present when storyPoint research was adjudicated. */
  storyResearchCanProceed?: boolean;
  storyResearchSkipReason?: StoryResearchSkipReason | null;
  externalSearchRequestCount?: number;
  evidenceBackedStoryBrief?: EvidenceBackedStoryBrief | null;
};

function mapStoryVerdictToAcrb(
  verdict: StoryEvidenceSupportStatus,
): AudienceContentResearchBrief["researchVerdict"] {
  if (verdict === "SUPPORTED") return "PROCEED";
  if (verdict === "PARTIALLY_SUPPORTED") return "PROCEED_WITH_CAUTION";
  return "SKIP";
}

function contentAnglesFromStoryFraming(
  framing: string[],
  storyPoint: StoryContentPoint,
): AcrbContentAngle[] {
  return framing.map((text, index) => ({
    angleId: `story_${storyPoint.pointId}_${index + 1}`,
    angle: text,
    hook: text.length > 80 ? `${text.slice(0, 77)}…` : text,
    audienceTension: storyPoint.audienceTension,
    interestScore: 0.72,
    noveltyScore: 0.65,
    evidenceStrength: 0.7,
    channelFit: {
      threads: 0.6,
      naver_blog: 0.55,
      naver_band: 0.45,
      kakao_channel: 0.4,
      shortform: 0.5,
      cardnews: 0.45,
    },
    rationale: "Evidence-backed story framing from targeted StoryPoint research (ED-2).",
    supportingFindingRefs: [],
    limitations: [],
  }));
}

function applyStoryResearchOverlay(input: {
  brief: AudienceContentResearchBrief;
  storyPoint: StoryContentPoint;
  storyPointHash: string;
  evidenceBrief: EvidenceBackedStoryBrief;
  alternateFallbackUsed: boolean;
  lockIssues?: string[];
}): AudienceContentResearchBrief {
  const { evidenceBrief } = input;
  const researchVerdict = mapStoryVerdictToAcrb(evidenceBrief.storySupportVerdict);
  const limitations = [...input.brief.limitations];
  if (input.lockIssues?.length) {
    limitations.push(...input.lockIssues.map((issue) => `story_research_lock:${issue}`));
  }
  if (evidenceBrief.limitations.length > 0) {
    limitations.push(...evidenceBrief.limitations.map((l) => `story_research:${l}`));
  }

  let contentAngles = input.brief.contentAngles;
  let recommendedAngleId = input.brief.recommendedAngleId;
  let recommendedAngleReason = input.brief.recommendedAngleReason;

  if (
    evidenceBrief.storySupportVerdict === "SUPPORTED" ||
    evidenceBrief.storySupportVerdict === "PARTIALLY_SUPPORTED"
  ) {
    const fromFraming = contentAnglesFromStoryFraming(
      evidenceBrief.researchSupportedFraming,
      input.storyPoint,
    );
    if (fromFraming.length > 0) {
      contentAngles = fromFraming;
      recommendedAngleId = fromFraming[0]?.angleId ?? null;
      recommendedAngleReason =
        evidenceBrief.storySupportVerdict === "PARTIALLY_SUPPORTED"
          ? "story_research_partial_boundary"
          : "story_research_supported_framing";
    }
  }

  const verdictReasons =
    researchVerdict === "SKIP"
      ? ([
          evidenceBrief.storySupportVerdict === "REFUTED"
            ? "insufficient_evidence"
            : "no_credible_takeaway",
        ] as AudienceContentResearchBrief["verdictReasons"])
      : input.brief.verdictReasons;

  return {
    ...input.brief,
    researchVerdict,
    verdictReasons,
    contentAngles,
    recommendedAngleId,
    recommendedAngleReason,
    limitations: [...new Set(limitations)].slice(0, 24),
    storyPointRef: {
      storyPointId: input.storyPoint.pointId,
      storyPointHash: input.storyPointHash,
      researchContractVersion: STORY_RESEARCH_CONTRACT_VERSION,
    },
    storyPointHash: input.storyPointHash,
    storySupportVerdict: evidenceBrief.storySupportVerdict,
    supportedClaimBoundary: evidenceBrief.supportedClaimBoundary,
    researchQuestionFindings: evidenceBrief.researchQuestionFindings,
    contradictedClaims: evidenceBrief.contradictedClaims,
    unresolvedQuestions: evidenceBrief.unresolvedQuestions,
    evidenceBackedStoryBrief: evidenceBrief,
    researchExecutionStatus: evidenceBrief.researchExecutionStatus,
    alternateUsed: Boolean(input.alternateFallbackUsed),
  };
}

export async function ensureAudienceContentResearch(
  input: EnsureAcrbInput,
): Promise<EnsureAcrbResult> {
  const storyPoint = input.storyPoint ?? null;
  const storyPointHash = input.storyPointHash ?? null;
  const evidenceFingerprint = buildEvidenceFingerprint(
    input.handoff.contentAssignment.evidenceRefs ?? [],
  );
  const preselectionResearchBriefId =
    input.handoff.selectedAgenda.provenance.researchBriefId ??
    input.compactBrief?.researchBriefId ??
    null;
  const expectedLogicalIdentity = buildAcrbLogicalIdentity({
    selectedAgendaId: input.handoff.selectedAgenda.id,
    assignmentId: input.handoff.contentAssignment.assignmentId,
    evidenceFingerprint,
    preselectionResearchBriefId,
    storyPointHash: storyPoint ? storyPointHash : null,
    researchContractVersion: storyPoint ? STORY_RESEARCH_CONTRACT_VERSION : null,
  });

  if (!input.forceRegenerate) {
    const existing = await loadDurableAcrb({
      repo: input.productionRequestRepo,
      logicalRunKey: input.logicalRunKey,
      expectedLogicalIdentity,
    });
    if (existing) {
      const evidenceBrief = existing.evidenceBackedStoryBrief ?? null;
      const proceed = evidenceBrief
        ? assertStoryResearchCanProceed(evidenceBrief)
        : storyPoint
          ? { ok: false, reason: "story_point_research_failed" as const }
          : { ok: true, reason: null };
      return {
        brief: {
          ...existing,
          provenance: { ...existing.provenance, synthesisMode: "reused" },
        },
        reused: true,
        persisted: false,
        externalResearchReused: false,
        storyResearchCanProceed: storyPoint ? proceed.ok : undefined,
        storyResearchSkipReason: storyPoint && !proceed.ok ? proceed.reason : null,
        externalSearchRequestCount: existing.provenance.searchRequestCount ?? 0,
        evidenceBackedStoryBrief: evidenceBrief,
      };
    }
  }

  const gathered = await gatherAcrbInputs({
    handoff: input.handoff,
    compactBrief: input.compactBrief,
    compactCandidate: input.compactCandidate,
    deps: {
      loadFullResearchBrief: input.loadFullResearchBrief,
      listRecentCandidateTitles: input.listRecentCandidateTitles,
      cooledIdentity: input.cooledIdentity,
      semanticAvailable: input.semanticAvailable,
      storyPoint,
      storyPointHash,
      storyPointGatePass: Boolean(storyPoint),
    },
  });

  let externalResearch: ExternalResearchBundle | null = null;
  let externalResearchReused = false;

  if (input.externalResearch !== undefined) {
    externalResearch = input.externalResearch;
  } else if (input.skipExternalResearch) {
    const priorRequest = await input.productionRequestRepo.findByLogicalKey(input.logicalRunKey);
    const priorBrief = readAcrbFromProductionRequest(priorRequest);
    const reconstructed = priorBrief
      ? reconstructExternalBundleFromAcrb({ brief: priorBrief })
      : null;
    externalResearch = reconstructed;
    externalResearchReused = Boolean(reconstructed);
  } else {
    const maxQueries = input.maxQueries ?? STORY_RESEARCH_MAX_QUERIES_PER_STORY;
    const maxPaidSearchRequests =
      input.remainingSearchBudget !== undefined ? input.remainingSearchBudget : undefined;
    externalResearch = await runBoundedExternalResearch({
      handoff: input.handoff,
      editorial: gathered.editorial,
      storyPoint,
      searchProvider: input.searchProvider,
      cache: input.searchCache,
      fetchImpl: input.fetchImpl,
      now: input.now,
      maxQueries: storyPoint ? maxQueries : undefined,
      maxPaidSearchRequests,
    });
  }

  const externalSearchRequestCount =
    externalResearch?.searchRequestCount ?? externalResearch?.attemptedQueryCount ?? 0;

  const brief = await synthesizeAudienceContentResearch({
    gathered: {
      ...gathered,
      externalResearch,
    },
    invoke: input.invoke,
    now: input.now,
  });

  let finalBrief =
    storyPoint && storyPointHash
      ? {
          ...brief,
          logicalIdentity: expectedLogicalIdentity,
          id: buildAcrbId(expectedLogicalIdentity),
        }
      : brief;
  let evidenceBackedStoryBrief: EvidenceBackedStoryBrief | null = null;
  let storyResearchCanProceed: boolean | undefined;
  let storyResearchSkipReason: StoryResearchSkipReason | null = null;

  if (storyPoint && storyPointHash) {
    const topicIdentity =
      brief.topicIdentity ??
      deriveAgendaTopicIdentity({
        selectedAgenda: input.handoff.selectedAgenda,
        assignment: input.handoff.contentAssignment,
        weakHooks: gathered.editorial?.hookSignals ?? [],
      });

    evidenceBackedStoryBrief = adjudicateStoryResearch({
      storyPoint,
      storyPointHash,
      agendaLogicalIdentity: expectedLogicalIdentity,
      externalResearch,
      alternateFallbackUsed: Boolean(input.alternateFallbackUsed),
      verdictOverride: input.verdictOverride ?? null,
      supportedClaimBoundaryOverride: input.supportedClaimBoundaryOverride ?? null,
      questionFindingsOverride: input.questionFindingsOverride ?? null,
    });

    let lockIssues: string[] = [];
    if (input.validateResearchLock !== false) {
      const lock = validateStoryResearchLock({
        storyPoint,
        brief: evidenceBackedStoryBrief,
        topicIdentity,
      });
      if (!lock.ok) {
        lockIssues = lock.issues;
        if (
          evidenceBackedStoryBrief.storySupportVerdict === "SUPPORTED" ||
          evidenceBackedStoryBrief.storySupportVerdict === "PARTIALLY_SUPPORTED"
        ) {
          evidenceBackedStoryBrief = {
            ...evidenceBackedStoryBrief,
            storySupportVerdict: "INSUFFICIENT_EVIDENCE",
            limitations: [
              ...evidenceBackedStoryBrief.limitations,
              "research_lock_failed",
            ],
          };
        }
      }
    }

    finalBrief = applyStoryResearchOverlay({
      brief: finalBrief,
      storyPoint,
      storyPointHash,
      evidenceBrief: evidenceBackedStoryBrief,
      alternateFallbackUsed: Boolean(input.alternateFallbackUsed),
      lockIssues,
    });

    const proceed = assertStoryResearchCanProceed(evidenceBackedStoryBrief);
    storyResearchCanProceed = proceed.ok;
    storyResearchSkipReason = proceed.ok ? null : proceed.reason;
  }

  await persistDurableAcrb({
    repo: input.productionRequestRepo,
    logicalRunKey: input.logicalRunKey,
    brief: finalBrief,
    now: input.now,
  });

  return {
    brief: finalBrief,
    reused: false,
    persisted: true,
    externalResearchReused,
    storyResearchCanProceed,
    storyResearchSkipReason,
    externalSearchRequestCount,
    evidenceBackedStoryBrief,
  };
}
