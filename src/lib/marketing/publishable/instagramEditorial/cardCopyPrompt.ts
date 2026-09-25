/**
 * Instagram Card Copy Writer — prompt input builders.
 * Deterministic slicing of Narrative + Carousel for card-centric LLM context.
 * Does not invent facts, reassign beats, or rewrite lexical surface (LLM owns that).
 */

import {
  CARD_COPY_NATURAL_KOREAN_CONTRACT_EN,
  CARD_COPY_SURFACE_WRITING_REQUIREMENTS_NOTE,
} from "@/lib/marketing/agentContracts/cardCopyNaturalKoreanContract";
import { CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY } from "@/lib/marketing/agentContracts/plannerVocabularyBoundary";
import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import type {
  InstagramCarouselCardPlan,
  InstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";

export type InstagramCardCopyBeatMessage = {
  beatId: string;
  purpose: string;
  /** Semantic intent only — not surface wording to preserve. */
  message: string;
  wordingAuthority: "semantic_intent_only";
};

export type InstagramCardCopyPromptCard = {
  cardId: string;
  role: InstagramCarouselCardPlan["role"];
  beatIds: string[];
  beatMessages: InstagramCardCopyBeatMessage[];
  /** Semantic intent only — not surface wording to preserve. */
  communicationGoal: string;
  communicationGoalAuthority: "semantic_intent_only";
  visualPriority: InstagramCarouselCardPlan["visualPriority"];
};

/**
 * Map each carousel card to its assigned beat messages from the Narrative Plan.
 * Missing beatIds are omitted (not invented).
 */
export function buildInstagramCardCopyPromptCards(input: {
  carousel: InstagramCarouselPlan;
  narrative: EditorialNarrativePlan;
}): InstagramCardCopyPromptCard[] {
  const beatById = new Map(input.narrative.beats.map((b) => [b.beatId, b]));
  return input.carousel.cards.map((card) => {
    const beatMessages: InstagramCardCopyBeatMessage[] = [];
    for (const beatId of card.beatIds) {
      const beat = beatById.get(beatId);
      if (!beat) continue;
      beatMessages.push({
        beatId: beat.beatId,
        purpose: beat.purpose,
        message: beat.message,
        wordingAuthority: "semantic_intent_only",
      });
    }
    return {
      cardId: card.cardId,
      role: card.role,
      beatIds: [...card.beatIds],
      beatMessages,
      communicationGoal: card.communicationGoal,
      communicationGoalAuthority: "semantic_intent_only",
      visualPriority: card.visualPriority,
    };
  });
}

export type InstagramCardCopyCanonicalPromptSlice = {
  assetId: string;
  titleKo: string;
  openingHookKo: string | null;
  bodyKo: string | null;
  keyTakeawaysKo: string[] | null | undefined;
  supportedClaimBoundaryKo: string | null | undefined;
  forbiddenClaimsKo: string[] | null | undefined;
};

/** Soft mobile line targets for Card Copy Writer (approximate; not px hardcodes). */
export const INSTAGRAM_CARD_COPY_MOBILE_DENSITY = {
  defaultBodyLines: { min: 3, softTargetMax: 4 },
  contextOrEvidenceBodyLines: { softTargetMax: 5 },
  exceptionalBodyLines: 6,
  headlineLines: { preferredMax: 2, exceptional: 3 },
  hookCoverBodyLines: { softMax: 3 },
  closingBodyLines: { preferredMin: 2, preferredMax: 4 },
} as const;

export function mobileDensityGuidanceForRole(
  role: InstagramCarouselCardPlan["role"],
): {
  role: InstagramCarouselCardPlan["role"];
  bodySoftTargetLines: string;
  notes: string[];
} {
  switch (role) {
    case "hook_cover":
      return {
        role,
        bodySoftTargetLines: "1–3",
        notes: [
          "Headline-led cover; do not over-explain.",
          "Keep concrete hook context; avoid essay length.",
        ],
      };
    case "reframe":
      return {
        role,
        bodySoftTargetLines: "3–4",
        notes: [
          "Do not restate the hook's familiar frame.",
          "Advance to what changes (terrain / place / direction) in natural Korean — not planner shorthand.",
        ],
      };
    case "context":
      return {
        role,
        bodySoftTargetLines: "3–5",
        notes: [
          "1–2 concrete anchors (people/place/environment).",
          "No repeated cultural abstractions.",
        ],
      };
    case "evidence":
    case "evidence_detail":
      return {
        role,
        bodySoftTargetLines: "3–5",
        notes: [
          "What it is + why it matters (two points enough).",
          "Do not pad long architectural essays.",
        ],
      };
    case "closing":
      return {
        role,
        bodySoftTargetLines: "2–4",
        notes: [
          "Recover prior-card payoff in concrete natural Korean; prefer 2–4 lines.",
          "No new long explanation; not CTA by default; avoid forced frame/rhythm metaphors.",
        ],
      };
    default:
      return {
        role,
        bodySoftTargetLines: "3–4",
        notes: ["Keep context; remove verbal redundancy."],
      };
  }
}

const SEMANTIC_INTENT_BANNER =
  "SEMANTIC INTENT ONLY / NOT SURFACE WORDING — preserve meaning; rewrite into natural consumer Korean.";

/**
 * Full user payload for the Card Copy Writer oneshot.
 * Full Narrative + Carousel remain available; `cards` is the explicit per-card slice.
 */
export function buildInstagramCardCopyWriterPayload(input: {
  narrative: EditorialNarrativePlan;
  carousel: InstagramCarouselPlan;
  canonicalAsset: InstagramCardCopyCanonicalPromptSlice;
}): Record<string, unknown> {
  const cards = buildInstagramCardCopyPromptCards({
    carousel: input.carousel,
    narrative: input.narrative,
  });
  const U = CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY;
  return {
    task: "instagram_card_copy",
    promptSections: {
      A_FACTUAL_SOURCE: "canonicalAsset — factual authority / claim boundaries",
      B_CARD_STRUCTURE: "instagramCarouselPlan + cards[].role/beatIds/visualPriority",
      C_SEMANTIC_INTENT: SEMANTIC_INTENT_BANNER,
      D_SURFACE_WRITING: CARD_COPY_SURFACE_WRITING_REQUIREMENTS_NOTE,
    },
    upstreamVocabularyBoundary: {
      ...U,
      banner: SEMANTIC_INTENT_BANNER,
    },
    editorialNarrativePlan: {
      ...input.narrative,
      _wordingAuthority: "semantic_intent_only",
      narrativePromiseAuthority: "semantic_intent_only",
    },
    instagramCarouselPlan: input.carousel,
    cards: cards.map((card) => ({
      ...card,
      mobileDensity: mobileDensityGuidanceForRole(card.role),
      _beatMessageNote: SEMANTIC_INTENT_BANNER,
      _communicationGoalNote: SEMANTIC_INTENT_BANNER,
    })),
    mobileDensityContract: {
      ...INSTAGRAM_CARD_COPY_MOBILE_DENSITY,
      principle:
        "Keep beat-scoped context density; compress verbal redundancy for mobile cardnews (~3–4 body lines soft target). Never retreat to abstract slogan-only summary. Natural Korean ≠ less information.",
      compressionAllowed: [
        "merge same-meaning sentences",
        "drop modifiers",
        "remove repeated premises",
        "do not restate headline in body",
        "replace vague abstracts with one concrete fact",
      ],
      compressionForbidden: [
        "delete concrete context/evidence",
        "abstract-only body retreat",
        "Canonical-external facts",
        "hard truncate / deterministic char cut",
        "blacklist or synonym-map substitution",
      ],
    },
    surfaceWritingRequirements: CARD_COPY_SURFACE_WRITING_REQUIREMENTS_NOTE,
    naturalKoreanContractSummary: CARD_COPY_NATURAL_KOREAN_CONTRACT_EN.slice(0, 800),
    canonicalAsset: input.canonicalAsset,
  };
}

/**
 * Structured user prompt (sections A–D) wrapping the JSON payload.
 * Deterministic assembly only — no lexical rewriting of upstream text.
 */
export function buildInstagramCardCopyWriterUserPrompt(payload: Record<string, unknown>): string {
  const U = CARD_COPY_UPSTREAM_VOCABULARY_BOUNDARY;
  return [
    "Return ONLY valid JSON matching the schema described in your SOUL.",
    "",
    "=== A. FACTUAL SOURCE ===",
    "Canonical fields below are factual authority. Respect supportedClaimBoundaryKo / forbiddenClaimsKo.",
    "",
    "=== B. CARD STRUCTURE ===",
    "Carousel cardId / order / role / beatIds are fixed. Do not redesign structure.",
    "",
    "=== C. SEMANTIC INTENT — DO NOT COPY PHRASING ===",
    U.semanticNotPhrasing,
    U.rewriteMeaning,
    U.fieldsNotSeeds,
    SEMANTIC_INTENT_BANNER,
    "",
    "=== D. SURFACE WRITING REQUIREMENTS ===",
    CARD_COPY_SURFACE_WRITING_REQUIREMENTS_NOTE,
    "Follow NATURAL KOREAN CONSUMER VOICE + mobile density rules in your SOUL.",
    "",
    "=== INPUT_JSON ===",
    JSON.stringify(payload),
  ].join("\n");
}
