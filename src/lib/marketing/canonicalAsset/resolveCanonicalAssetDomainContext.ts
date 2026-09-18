/**
 * Resolve Story / Evidence / Proposition locks for Canonical Asset validation.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseAudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/validate";
import { AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH } from "@/lib/marketing/audienceResearch/paths";
import type { AudienceContentResearchBrief } from "@/lib/marketing/audienceResearch/contracts";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import {
  STORY_CONTENT_POINT_CONTRACT,
  type DurableStoryPointCandidateSet,
  type EvidenceBackedStoryBrief,
  type StoryContentPoint,
} from "@/lib/marketing/storyPoint/contracts";
import { parseDurableStoryPointCandidateSet } from "@/lib/marketing/storyPoint/persistence";

export type CanonicalAssetDomainContext = {
  storyPoint: StoryContentPoint | null;
  storyPointHash: string | null;
  evidenceBrief: EvidenceBackedStoryBrief | null;
  proposition: ContentProposition | null;
};

function readAcrbFromPackage(packageRoot: string | null | undefined): AudienceContentResearchBrief | null {
  if (!packageRoot) return null;
  try {
    const path = join(packageRoot, AUDIENCE_CONTENT_RESEARCH_BRIEF_RELATIVE_PATH);
    if (!existsSync(path)) return null;
    return parseAudienceContentResearchBrief(JSON.parse(readFileSync(path, "utf8")));
  } catch {
    return null;
  }
}

function readStorySetFromPackage(
  packageRoot: string | null | undefined,
): DurableStoryPointCandidateSet | null {
  if (!packageRoot) return null;
  // Best-effort: some packages may mirror the production-request metadata blob.
  for (const relative of [
    "story-point-candidate-set.json",
    "editorial/story-point-candidate-set.json",
    "research/story-point-candidate-set.json",
  ]) {
    try {
      const path = join(packageRoot, relative);
      if (!existsSync(path)) continue;
      const parsed = parseDurableStoryPointCandidateSet(JSON.parse(readFileSync(path, "utf8")));
      if (parsed) return parsed;
    } catch {
      /* try next */
    }
  }
  return null;
}

/**
 * Lock-only Story stub when the full CandidateSet is unavailable.
 * Preserves storyPointId/hash checks; does not invent editorial story text.
 */
function lockOnlyStoryPoint(asset: CanonicalMarketingAsset): StoryContentPoint {
  return {
    contract: STORY_CONTENT_POINT_CONTRACT,
    pointId: asset.storyPointId,
    storyQuestion: null,
    storyClaim: null,
    whyInteresting: "",
    audienceTension: "",
    curiosityGap: "",
    readerPayoff: "",
    mechanisms: [],
    researchNeeded: [],
    researchQuestions: [],
    genericRisk: "",
    genericRiskMitigation: null,
    channelPotential: {
      conversation: "low",
      visualExplainability: "low",
      searchDepth: "low",
      shortformHookability: "low",
    },
    nonGoals: [],
    agendaFitNotes: null,
    // Recover authoritative archetype from approved asset provenance when Story set is missing.
    editorialArchetype: asset.editorialArchetype?.trim() || null,
  };
}

export function resolveCanonicalAssetDomainContext(input: {
  candidate: CompletedMarketingCandidate;
  packageRoot?: string | null;
  audienceContentResearchBrief?: AudienceContentResearchBrief | null;
  storyPointCandidateSet?: DurableStoryPointCandidateSet | null;
}): CanonicalAssetDomainContext {
  const asset = input.candidate.canonicalMarketingAsset ?? null;
  const acrb =
    input.audienceContentResearchBrief ??
    readAcrbFromPackage(input.packageRoot) ??
    null;
  const set =
    input.storyPointCandidateSet ??
    readStorySetFromPackage(input.packageRoot) ??
    null;

  const storyId =
    asset?.storyPointId?.trim() ||
    set?.primaryStoryPointId?.trim() ||
    acrb?.storyPointRef?.storyPointId?.trim() ||
    null;
  const storyFromSet =
    storyId && set
      ? (set.candidates.find((c) => c.pointId === storyId) ?? null)
      : null;

  const storyPointHash =
    asset?.storyPointHash?.trim() ||
    set?.primaryStoryPointHash?.trim() ||
    acrb?.storyPointRef?.storyPointHash?.trim() ||
    acrb?.storyPointHash?.trim() ||
    null;

  const storyPoint =
    storyFromSet ??
    (asset?.storyPointId?.trim() && asset.storyPointHash?.trim()
      ? lockOnlyStoryPoint(asset)
      : null);

  const evidenceBrief = acrb?.evidenceBackedStoryBrief ?? null;
  const proposition = input.candidate.contentPlan?.proposition ?? null;

  return {
    storyPoint,
    storyPointHash: storyPointHash || (storyPoint ? asset?.storyPointHash ?? null : null),
    evidenceBrief,
    proposition,
  };
}

export function canValidateCanonicalAssetAgainstDomain(
  ctx: CanonicalAssetDomainContext,
): ctx is CanonicalAssetDomainContext & {
  storyPoint: StoryContentPoint;
  storyPointHash: string;
  proposition: ContentProposition;
} {
  return Boolean(ctx.storyPoint && ctx.storyPointHash && ctx.proposition);
}
