/**
 * Structured inputs for publishable composers — evidence-aware, no UUID in prose.
 */

import { createHash } from "node:crypto";

import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { HumanReviewDraft } from "@/lib/marketing/review/types";
import type { PublishableChannel } from "@/lib/marketing/publishable/contracts";
import { resolveTargetPublishableChannels } from "@/lib/marketing/publishable/selectTargetChannels";

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
): string {
  const proposition = candidate.contentPlan?.proposition;
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
  },
): PublishableComposerInput {
  const unsupported = (candidate.governanceDecision?.unsupportedClaims ?? []).map((c) =>
    normalizeStatement(String(c)),
  );
  const unsupportedLower = new Set(unsupported.map((s) => s.toLowerCase()).filter(Boolean));
  const acrb = options?.acrb ?? null;
  const research = buildResearchContextFromAcrb(acrb);

  const usableFacts: PublishableComposerFact[] = [];
  const avoidedStatements: string[] = [];

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

  for (const avoid of candidate.contentPlan?.factsToAvoid ?? []) {
    const statement = normalizeStatement(avoid);
    if (statement) avoidedStatements.push(statement);
  }

  const evidenceRefIds = [
    ...new Set(usableFacts.flatMap((f) => f.evidenceRefIds).filter(Boolean)),
  ].slice(0, 24);

  const destinations = [...(candidate.selectedAgenda.destinations ?? [])];
  if (destinations.length === 0) {
    const hay = `${candidate.selectedAgenda.title}\n${candidate.contentAssignment.topic}\n${candidate.contentPlan?.keyMessage ?? ""}`;
    for (const place of ["부산", "다낭", "오사카", "도쿄", "후쿠오카", "오키나와", "방콕", "싱가포르", "유럽", "제주"]) {
      if (hay.includes(place)) destinations.push(place);
    }
  }

  const targetChannels = resolveTargetPublishableChannels({
    explicit: options?.explicitTargetChannels,
    contentPlanTargetChannels: candidate.contentPlan?.targetChannels ?? null,
  });

  return {
    candidateId: candidate.candidateId,
    businessDateKst: candidate.businessDateKst,
    topic: candidate.contentAssignment.topic || candidate.selectedAgenda.title,
    audience:
      candidate.contentPlan?.proposition?.primaryAudience ??
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
      candidate.contentPlan?.proposition?.contentPromise ??
      candidate.contentPlan?.keyMessage ??
      research?.selectedAngle ??
      candidate.selectedAgenda.summary ??
      null,
    destinations,
    entities: [...(candidate.selectedAgenda.entities ?? [])],
    usableFacts: usableFacts.slice(0, 10),
    avoidedStatements: [...new Set(avoidedStatements)].slice(0, 10),
    unsupportedClaims: unsupported.slice(0, 12),
    governanceDecision: candidate.governanceDecision?.decision ?? null,
    sourceRevision: computePublishableSourceRevision(candidate, null, acrb),
    evidenceRefIds,
    research,
    targetChannels,
    contentProposition: candidate.contentPlan?.proposition ?? null,
  };
}
