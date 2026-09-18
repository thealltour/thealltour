import { createHash } from "node:crypto";

import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type { EvidenceBackedStoryBrief } from "@/lib/marketing/storyPoint/contracts";
import type { StoryContentPoint } from "@/lib/marketing/storyPoint/contracts";
import type { CanonicalAssetWriterInput } from "@/lib/marketing/canonicalAsset/contracts";

function norm(text: string | null | undefined): string {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Resolve Story editorialArchetype for the locked writer input.
 * Preserves exact upstream value; never invents a default archetype.
 * Legacy external imports may only have `archetype:` in agendaFitNotes.
 */
export function resolveStoryEditorialArchetype(
  storyPoint: Pick<StoryContentPoint, "editorialArchetype" | "agendaFitNotes">,
): string | null {
  const direct = storyPoint.editorialArchetype?.trim();
  if (direct) return direct;
  const notes = storyPoint.agendaFitNotes ?? "";
  const match = notes.match(/(?:^|\|\s*)archetype:([^\s|]+)/i);
  const fromNotes = match?.[1]?.trim();
  return fromNotes || null;
}

export function computeCanonicalAssetSourceRevision(input: {
  storyPointId: string;
  storyPointHash: string;
  evidenceRevision: string;
  propositionRevision: string;
  supportedClaimBoundary: string | null;
  editorialArchetype?: string | null;
}): string {
  const parts = [
    input.storyPointId.trim(),
    input.storyPointHash.trim(),
    input.evidenceRevision.trim(),
    input.propositionRevision.trim(),
    norm(input.supportedClaimBoundary),
  ];
  // Only fold archetype into the lock when present so legacy null stays hash-stable;
  // a later archetype set/change still stales the Canonical Asset.
  const archetype = (input.editorialArchetype ?? "").trim();
  if (archetype) parts.push(norm(archetype));
  return createHash("sha256").update(parts.join("\n"), "utf8").digest("hex").slice(0, 24);
}

export function computeEvidenceRevision(brief: EvidenceBackedStoryBrief | null): string {
  if (!brief) return "no_evidence";
  const payload = [
    brief.storyPointId,
    brief.storyPointHash,
    brief.storySupportVerdict,
    brief.supportedClaimBoundary ?? "",
    brief.researchQuestionFindings.map((f) => `${f.question}|${f.status}|${f.finding}`).join(";"),
    brief.contradictedClaims.join("|"),
    brief.unresolvedQuestions.join("|"),
  ].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 24);
}

export function computePropositionRevision(proposition: ContentProposition): string {
  const payload = [
    proposition.angle,
    proposition.keyMessage,
    proposition.contentPromise,
    proposition.readerGain,
    proposition.specificTakeaways.join("|"),
    proposition.supportedClaimBoundaryUsed ?? "",
    proposition.propositionSourceRevision ?? "",
  ].join("\n");
  return createHash("sha256").update(payload, "utf8").digest("hex").slice(0, 24);
}

export function buildCanonicalAssetWriterInput(input: {
  agendaId: string;
  storyPoint: StoryContentPoint;
  storyPointHash: string;
  evidenceBrief: EvidenceBackedStoryBrief | null;
  proposition: ContentProposition;
  topicIdentitySummary: string;
  brandContextKo?: string | null;
}): CanonicalAssetWriterInput {
  const evidenceRevision = computeEvidenceRevision(input.evidenceBrief);
  const propositionRevision = computePropositionRevision(input.proposition);
  const boundary =
    input.evidenceBrief?.supportedClaimBoundary ??
    input.proposition.supportedClaimBoundaryUsed ??
    null;
  return {
    agendaId: input.agendaId,
    storyPointId: input.storyPoint.pointId,
    storyPointHash: input.storyPointHash,
    storyQuestion: input.storyPoint.storyQuestion,
    storyClaim: input.storyPoint.storyClaim,
    whyInteresting: input.storyPoint.whyInteresting,
    audienceTension: input.storyPoint.audienceTension,
    curiosityGap: input.storyPoint.curiosityGap,
    readerPayoff: input.storyPoint.readerPayoff,
    editorialArchetype: resolveStoryEditorialArchetype(input.storyPoint),
    storySupportVerdict:
      input.evidenceBrief?.storySupportVerdict ??
      input.proposition.storySupportVerdict ??
      "UNKNOWN",
    supportedClaimBoundary: boundary,
    evidenceBriefRef: input.evidenceBrief
      ? `${input.evidenceBrief.contract}:${input.evidenceBrief.storyPointId}`
      : null,
    evidenceRevision,
    researchQuestionFindings: (input.evidenceBrief?.researchQuestionFindings ?? []).map((f) => ({
      question: f.question,
      status: f.status,
      finding: f.finding,
    })),
    contradictedClaims: input.evidenceBrief?.contradictedClaims ?? [],
    unresolvedQuestions: input.evidenceBrief?.unresolvedQuestions ?? [],
    evidenceLimitations: input.evidenceBrief?.limitations ?? [],
    researchSupportedFraming: input.evidenceBrief?.researchSupportedFraming ?? [],
    proposition: {
      angle: input.proposition.angle,
      keyMessage: input.proposition.keyMessage,
      audienceProblem: input.proposition.audienceProblem,
      audienceTension: input.proposition.audienceTension,
      contentPromise: input.proposition.contentPromise,
      readerGain: input.proposition.readerGain,
      specificTakeaways: input.proposition.specificTakeaways,
      limitations: input.proposition.limitations,
      commercialIntent: String(input.proposition.commercialIntent),
      propositionRevision,
      contentPropositionRef: input.proposition.contract,
      supportedClaimBoundaryUsed: input.proposition.supportedClaimBoundaryUsed ?? null,
    },
    topicIdentitySummary: input.topicIdentitySummary,
    commercialIntent: String(input.proposition.commercialIntent),
    brandContextKo: input.brandContextKo ?? null,
  };
}

export function createCanonicalAssetId(sourceRevision: string): string {
  return `cma_${sourceRevision}`;
}
