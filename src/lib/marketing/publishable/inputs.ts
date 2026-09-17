/**
 * Structured inputs for publishable composers — evidence-aware, no UUID in prose.
 */

import { createHash } from "node:crypto";

import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { HumanReviewDraft } from "@/lib/marketing/review/types";
import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";
import { resolveTargetPublishableChannels } from "@/lib/marketing/publishable/selectTargetChannels";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import { resolveCanonicalAssetDomainContext } from "@/lib/marketing/canonicalAsset/resolveCanonicalAssetDomainContext";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";

export type PublishableComposerFact = {
  statement: string;
  confidence: "high" | "medium" | "low" | string;
  evidenceRefIds: string[];
  usable: boolean;
  epistemicType?: "verified_fact" | "observed_signal" | "inference" | "hypothesis" | string;
};

export type PublishableResearchContext = {
  researchBriefId: string | null;
  selectedAngleId: string | null;
  selectedAngle: string | null;
  selectedAngleTension: string | null;
  selectedAngleRationale: string | null;
  audiencePrimary: string[];
  motivations: string[];
  anxieties: string[];
  objections: string[];
  decisionTriggers: string[];
  searchIntentPrimary: string | null;
  searchQuestions: string[];
  contentGaps: string[];
  channelFit: Record<string, number> | null;
  researchVerdict: string | null;
  limitations: string[];
  findingHints: Array<{ text: string; type: string }>;
};

export type PublishableStoryLock = {
  /** Read-only Story identity — not a creative source. */
  role: "STORY_LOCK_READ_ONLY";
  storyPointId: string | null;
  storyPointHash: string | null;
  storyTitleKo: string | null;
  storyQuestionKo: string | null;
  audienceProblemKo: string | null;
  decisionAtStakeKo: string | null;
  audienceTensionKo: string | null;
  readerPayoffKo: string | null;
};

export type PublishableComposerInput = {
  candidateId: string;
  businessDateKst: string;
  topic: string;
  audience: string | null;
  commercialIntent: string;
  hookHint: string | null;
  keyMessage: string | null;
  destinations: string[];
  entities: string[];
  usableFacts: PublishableComposerFact[];
  avoidedStatements: string[];
  unsupportedClaims: string[];
  governanceDecision: string | null;
  sourceRevision: string;
  evidenceRefIds: string[];
  research: PublishableResearchContext | null;
  targetChannels: PublishableChannel[];
  /** MQ-3 — available for composers; not consumed by deterministic composers yet. */
  contentProposition?: import("@/lib/marketing/content/proposition/contracts").ContentProposition | null;
  /**
   * Approved Canonical Marketing Asset — authoritative editorial content for channel editors.
   * Absent on legacy packages (composers fall back to prior inputs).
   */
  approvedCanonicalAsset?: CanonicalMarketingAsset | null;
  /** STEP 2 — read-only Story lock for approved-asset adapter mode. */
  storyLock?: PublishableStoryLock | null;
  /** STEP 2 — composition mode marker for prompt/observability. */
  compositionMode?: "approved_asset_adapter" | "legacy_proposition_driven";
  /**
   * Channel-agnostic core (facts, CTA intent, hedge list) fixed once per candidate.
   * Composers must treat this as the only fact source they may state.
   */
  corePack?: import("@/lib/marketing/publishable/core/coreContentPack").CoreContentPack | null;
  /** Human-review quality repair: Marketing Value hints → Content Strategist composer. */
  qualityRevision?: {
    hints: string[];
    priorBody?: string | null;
    reasons?: string[];
  } | null;
};

function normalizeStatement(text: string): string {
  return text
    .replace(/\[[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]/gi, "")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function computePublishableSourceRevision(
  candidate: CompletedMarketingCandidate,
  humanDraft?: HumanReviewDraft | null,
  acrb?: AudienceContentResearchBrief | null,
  approvedAsset?: CanonicalMarketingAsset | null,
): string {
  const proposition = candidate.contentPlan?.proposition;
  const asset = approvedAsset ?? candidate.canonicalMarketingAsset ?? null;
  const payload = {
    candidateId: candidate.candidateId,
    draftBody: candidate.draft.body,
    draftTitle: candidate.draft.title ?? null,
    planKey: candidate.contentPlan?.keyMessage ?? null,
    planHook: candidate.contentPlan?.hook ?? null,
    planChannels: candidate.contentPlan?.targetChannels ?? null,
    planAngle: candidate.contentPlan?.primaryAngle ?? null,
    proposition: proposition
      ? {
          strength: proposition.propositionStrength,
          promise: proposition.contentPromise,
          gain: proposition.readerGain,
          takeaways: proposition.specificTakeaways,
          angle: proposition.angle,
          storyPointHash: proposition.storyPointHash ?? null,
          storySupportVerdict: proposition.storySupportVerdict ?? null,
          supportedClaimBoundaryUsed: proposition.supportedClaimBoundaryUsed ?? null,
          propositionSourceRevision: proposition.propositionSourceRevision ?? null,
        }
      : null,
    canonicalAsset: asset
      ? {
          assetId: asset.assetId,
          version: asset.version,
          approvedVersion: asset.approvedVersion,
          sourceRevision: asset.sourceRevision,
          status: asset.status,
          bodyHash: createHash("sha256").update(asset.bodyKo ?? "", "utf8").digest("hex").slice(0, 16),
        }
      : null,
    facts: candidate.contentAssignment.facts.map((f) => [f.factId, f.statement, f.confidence]),
    unsupported: candidate.governanceDecision?.unsupportedClaims ?? [],
    decision: candidate.governanceDecision?.decision ?? null,
    humanBody: humanDraft?.body ?? null,
    humanTitle: humanDraft?.title ?? null,
    acrbId: acrb?.id ?? candidate.audienceContentResearchRef?.researchBriefId ?? null,
    acrbAngle: acrb?.recommendedAngleId ?? null,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 24);
}

export function buildResearchContextFromAcrb(
  acrb: AudienceContentResearchBrief | null | undefined,
): PublishableResearchContext | null {
  if (!acrb) return null;
  const angle =
    acrb.contentAngles.find((a) => a.angleId === acrb.recommendedAngleId) ??
    acrb.contentAngles[0] ??
    null;
  return {
    researchBriefId: acrb.id,
    selectedAngleId: angle?.angleId ?? acrb.recommendedAngleId,
    selectedAngle: angle?.angle ?? null,
    selectedAngleTension: angle?.audienceTension ?? null,
    selectedAngleRationale: angle?.rationale ?? null,
    audiencePrimary: acrb.audience.primary.map((x) => x.text).slice(0, 4),
    motivations: acrb.audience.motivations.map((x) => x.text).slice(0, 4),
    anxieties: acrb.audience.anxieties.map((x) => x.text).slice(0, 5),
    objections: acrb.audience.objections.map((x) => x.text).slice(0, 4),
    decisionTriggers: acrb.audience.decisionTriggers.map((x) => x.text).slice(0, 4),
    searchIntentPrimary: acrb.searchIntent.primaryIntent,
    searchQuestions: acrb.searchIntent.questions.map((x) => x.text).slice(0, 8),
    contentGaps: acrb.marketSignals.contentGaps.map((x) => x.text).slice(0, 5),
    channelFit: angle?.channelFit ?? null,
    researchVerdict: acrb.researchVerdict,
    limitations: acrb.limitations.slice(0, 8),
    findingHints: acrb.researchFindings.slice(0, 8).map((f) => ({
      text: f.text,
      type: f.type,
    })),
  };
}

export function buildPublishableComposerInput(
  candidate: CompletedMarketingCandidate,
  options?: {
    acrb?: AudienceContentResearchBrief | null;
    explicitTargetChannels?: PublishableChannel[] | null;
    approvedCanonicalAsset?: CanonicalMarketingAsset | null;
    packageRoot?: string | null;
  },
): PublishableComposerInput {
  const unsupported = (candidate.governanceDecision?.unsupportedClaims ?? []).map((c) =>
    normalizeStatement(String(c)),
  );
  const unsupportedLower = new Set(unsupported.map((s) => s.toLowerCase()).filter(Boolean));
  const acrb = options?.acrb ?? null;
  const research = buildResearchContextFromAcrb(acrb);
  const approvedAsset =
    options?.approvedCanonicalAsset ??
    (isApprovedCanonicalAsset(candidate.canonicalMarketingAsset)
      ? candidate.canonicalMarketingAsset
      : null);
  const compositionMode = approvedAsset ? "approved_asset_adapter" : "legacy_proposition_driven";

  const usableFacts: PublishableComposerFact[] = [];
  const avoidedStatements: string[] = [];

  // APPROVED-ASSET mode: do not feed contentAssignment/research facts as creative material.
  if (!approvedAsset) {
    for (const fact of candidate.contentAssignment.facts) {
      const statement = normalizeStatement(fact.statement);
      if (!statement) continue;
      const blocked =
        fact.confidence === "low" ||
        unsupportedLower.has(statement.toLowerCase()) ||
        unsupported.some((u) => u && statement.includes(u));
      if (blocked) {
        avoidedStatements.push(statement);
        continue;
      }
      usableFacts.push({
        statement,
        confidence: fact.confidence,
        evidenceRefIds: [...fact.evidenceRefs],
        usable: true,
        epistemicType: fact.confidence === "high" ? "verified_fact" : "observed_signal",
      });
    }

    if (research) {
      for (const finding of research.findingHints) {
        if (finding.type === "hypothesis" || finding.type === "inference") {
          avoidedStatements.push(finding.text);
          continue;
        }
        if (finding.type === "verified_fact" || finding.type === "observed_signal") {
          const statement = normalizeStatement(finding.text);
          if (!statement) continue;
          if (usableFacts.some((f) => f.statement === statement)) continue;
          usableFacts.push({
            statement,
            confidence: finding.type === "verified_fact" ? "high" : "medium",
            evidenceRefIds: [],
            usable: true,
            epistemicType: finding.type,
          });
        }
      }
    }
  }

  for (const avoid of candidate.contentPlan?.factsToAvoid ?? []) {
    const statement = normalizeStatement(avoid);
    if (statement) avoidedStatements.push(statement);
  }
  if (approvedAsset) {
    for (const claim of approvedAsset.forbiddenClaimsKo) {
      const statement = normalizeStatement(claim);
      if (statement) avoidedStatements.push(statement);
    }
  }

  const evidenceRefIds = approvedAsset
    ? [...new Set(approvedAsset.evidenceRefs.map((e) => e.evidenceId).filter(Boolean))].slice(0, 24)
    : [...new Set(usableFacts.flatMap((f) => f.evidenceRefIds).filter(Boolean))].slice(0, 24);

  const destinations = approvedAsset
    ? []
    : [...(candidate.selectedAgenda.destinations ?? [])];
  if (!approvedAsset && destinations.length === 0) {
    const hay = `${candidate.selectedAgenda.title}\n${candidate.contentAssignment.topic}\n${candidate.contentPlan?.keyMessage ?? ""}`;
    for (const place of [
      "부산",
      "다낭",
      "오사카",
      "도쿄",
      "후쿠오카",
      "오키나와",
      "방콕",
      "싱가포르",
      "유럽",
      "제주",
      "푸꾸옥",
    ]) {
      if (hay.includes(place)) destinations.push(place);
    }
  }

  const targetChannels = resolveTargetPublishableChannels({
    explicit: options?.explicitTargetChannels,
    contentPlanTargetChannels: candidate.contentPlan?.targetChannels ?? null,
  });

  const proposition = candidate.contentPlan?.proposition ?? null;
  const storyLock = buildPublishableStoryLock({
    candidate,
    approvedAsset,
    packageRoot: options?.packageRoot ?? null,
    acrb,
    proposition,
  });

  if (approvedAsset) {
    return {
      candidateId: candidate.candidateId,
      businessDateKst: candidate.businessDateKst,
      topic: approvedAsset.titleKo,
      audience: proposition?.primaryAudience ?? null,
      // commercialIntent kept only as format context; asset CTA wins in prompt rules
      commercialIntent: candidate.contentAssignment.commercialIntent,
      hookHint: approvedAsset.openingHookKo,
      keyMessage: approvedAsset.titleKo,
      destinations,
      entities: [],
      usableFacts: [],
      avoidedStatements: [...new Set(avoidedStatements)].slice(0, 16),
      unsupportedClaims: [
        ...unsupported.slice(0, 12),
        ...approvedAsset.forbiddenClaimsKo.slice(0, 8),
      ],
      governanceDecision: candidate.governanceDecision?.decision ?? null,
      sourceRevision: computePublishableSourceRevision(candidate, null, acrb, approvedAsset),
      evidenceRefIds,
      research: research
        ? {
            ...research,
            // Strip creative ACRB signals; keep safety-only fields for INPUT_JSON builder.
            selectedAngle: null,
            selectedAngleTension: null,
            selectedAngleRationale: null,
            selectedAngleId: null,
            searchIntentPrimary: null,
            searchQuestions: [],
            contentGaps: [],
            decisionTriggers: [],
            motivations: [],
            anxieties: [],
            objections: [],
            findingHints: [],
          }
        : null,
      targetChannels,
      contentProposition: proposition,
      approvedCanonicalAsset: approvedAsset,
      storyLock,
      compositionMode,
    };
  }

  return {
    candidateId: candidate.candidateId,
    businessDateKst: candidate.businessDateKst,
    topic: candidate.contentAssignment.topic || candidate.selectedAgenda.title,
    audience:
      proposition?.primaryAudience ??
      research?.audiencePrimary[0] ??
      candidate.contentPlan?.targetAudience ??
      candidate.contentAssignment.audience ??
      null,
    commercialIntent: candidate.contentAssignment.commercialIntent,
    hookHint:
      candidate.contentPlan?.hook ??
      research?.selectedAngleTension ??
      candidate.selectedAgenda.timelinessNote ??
      null,
    keyMessage:
      proposition?.contentPromise ??
      candidate.contentPlan?.keyMessage ??
      research?.selectedAngle ??
      candidate.selectedAgenda.summary ??
      null,
    destinations,
    entities: [...(candidate.selectedAgenda.entities ?? [])],
    usableFacts: usableFacts.slice(0, 10),
    avoidedStatements: [...new Set(avoidedStatements)].slice(0, 16),
    unsupportedClaims: unsupported.slice(0, 12),
    governanceDecision: candidate.governanceDecision?.decision ?? null,
    sourceRevision: computePublishableSourceRevision(candidate, null, acrb, approvedAsset),
    evidenceRefIds,
    research,
    targetChannels,
    contentProposition: proposition,
    approvedCanonicalAsset: approvedAsset,
    storyLock,
    compositionMode,
  };
}

function buildPublishableStoryLock(input: {
  candidate: CompletedMarketingCandidate;
  approvedAsset: CanonicalMarketingAsset | null;
  packageRoot: string | null;
  acrb: AudienceContentResearchBrief | null;
  proposition: ContentProposition | null;
}): PublishableStoryLock | null {
  if (!input.approvedAsset && !input.proposition) return null;
  const domain = resolveCanonicalAssetDomainContext({
    candidate: {
      ...input.candidate,
      canonicalMarketingAsset:
        input.approvedAsset ?? input.candidate.canonicalMarketingAsset ?? null,
    },
    packageRoot: input.packageRoot,
    audienceContentResearchBrief: input.acrb,
  });
  const story = domain.storyPoint;
  const prop = input.proposition ?? domain.proposition;
  const storyQuestion =
    story?.storyQuestion?.trim() ||
    prop?.supportedClaimBoundaryUsed?.trim() ||
    input.approvedAsset?.supportedClaimBoundaryKo?.trim() ||
    null;
  const storyTitle =
    storyQuestion ||
    story?.storyClaim?.trim() ||
    input.approvedAsset?.titleKo?.trim() ||
    null;
  const propTension = prop?.audienceTension?.trim() || null;
  const storyTension = story?.audienceTension?.trim() || null;
  return {
    role: "STORY_LOCK_READ_ONLY",
    storyPointId:
      input.approvedAsset?.storyPointId?.trim() ||
      story?.pointId?.trim() ||
      prop?.storyPointRef?.storyPointId?.trim() ||
      null,
    storyPointHash:
      input.approvedAsset?.storyPointHash?.trim() ||
      domain.storyPointHash?.trim() ||
      prop?.storyPointRef?.storyPointHash?.trim() ||
      prop?.storyPointHash?.trim() ||
      null,
    storyTitleKo: storyTitle,
    storyQuestionKo: storyQuestion,
    audienceProblemKo: prop?.audienceProblem?.trim() || null,
    // Consistency lock: tension doubles as decision-at-stake when no richer Story field exists.
    decisionAtStakeKo: propTension || storyTension || null,
    audienceTensionKo: storyTension || propTension || null,
    readerPayoffKo:
      story?.readerPayoff?.trim() ||
      prop?.readerGain?.trim() ||
      input.approvedAsset?.decisionGuidanceKo?.trim() ||
      null,
  };
}
