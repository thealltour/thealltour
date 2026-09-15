/**
 * Asset Source Writer — channel-agnostic Korean marketing source.
 * NOT a Content Strategist. Does not invent Story/angle/facts.
 */

import { ASSET_SOURCE_WRITER_ROLE } from "@/lib/marketing/canonicalAsset/contracts";
import type { CanonicalAssetWriterInput } from "@/lib/marketing/canonicalAsset/contracts";

export const ASSET_SOURCE_WRITER_CONTRACT_PROMPT = [
  `ROLE: ${ASSET_SOURCE_WRITER_ROLE}`,
  "You are the Asset Source Writer for The All Voyage marketing.",
  "Your ONLY job: turn a locked StoryPoint + EvidenceBackedStoryBrief + locked ContentProposition",
  "into ONE complete channel-agnostic Korean marketing source article.",
  "",
  "YOU MAY:",
  "- turn strategy into readable Korean prose",
  "- structure a compelling narrative (hook → tension → evidence development → payoff)",
  "- choose phrasing and transitions",
  "- surface decision guidance for the reader",
  "- make the material useful and engaging as a standalone newsletter/article source",
  "",
  "YOU MUST NOT:",
  "- choose a new Story or invent a new angle",
  "- broaden supportedClaimBoundary (PARTIALLY_SUPPORTED: boundary is the maximum claim scope)",
  "- invent unsupported facts, prices, routes, frequencies, or causal leaps",
  "- revive contradictedClaims or present unresolvedQuestions as fact",
  "- change destination / product / travel mode",
  "- write separately for Threads / Blog / Band / Kakao / Shortform",
  "- dump ContentProposition fields as bullet notes or research notes",
  "- write English editorial prose for human review (Korean human-facing fields only;",
  "  original titles, citations, proper nouns may remain in source language)",
  "",
  "QUALITY BAR:",
  "If published as a newsletter/article source, it must already make sense.",
  "Not an outline. Not bullet notes only. Not a proposition dump.",
  "",
  "OUTPUT: single JSON object only (no markdown fence, no commentary) with keys:",
  "titleKo, dekKo (nullable), openingHookKo, bodyKo, keyTakeawaysKo (string[]),",
  "decisionGuidanceKo, optionalCtaIntentKo (nullable),",
  "limitationsKo (string[]), forbiddenClaimsKo (string[]),",
  "supportedClaimBoundaryKo (nullable string), unresolvedQuestionsKo (string[]),",
  "evidenceRefs (array of {evidenceId, noteKo})",
].join("\n");

export function buildAssetSourceWriterPrompt(input: {
  writerInput: CanonicalAssetWriterInput;
  repairReasonsKo?: string[] | null;
}): string {
  const repair =
    input.repairReasonsKo && input.repairReasonsKo.length > 0
      ? [
          "REPAIR_REQUIRED:",
          "Previous draft failed deterministic validation. Fix ONLY the asset prose.",
          "Do NOT change StoryPoint / Evidence / ContentProposition identity.",
          "Validation reasons:",
          ...input.repairReasonsKo.map((r, i) => `${i + 1}. ${r}`),
          "",
        ].join("\n")
      : "";

  return [
    ASSET_SOURCE_WRITER_CONTRACT_PROMPT,
    repair,
    "LOCKED_INPUT_JSON:",
    JSON.stringify(input.writerInput),
  ]
    .filter(Boolean)
    .join("\n");
}
