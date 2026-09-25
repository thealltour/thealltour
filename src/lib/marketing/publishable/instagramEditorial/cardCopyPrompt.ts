/**
 * Instagram Card Copy Writer — prompt input builders.
 * Deterministic slicing of Narrative + Carousel for card-centric LLM context.
 * Does not invent facts or reassign beats.
 */

import type { EditorialNarrativePlan } from "@/lib/marketing/publishable/editorialNarrative/contracts";
import type {
  InstagramCarouselCardPlan,
  InstagramCarouselPlan,
} from "@/lib/marketing/publishable/instagramEditorial/contracts";

export type InstagramCardCopyBeatMessage = {
  beatId: string;
  purpose: string;
  message: string;
};

export type InstagramCardCopyPromptCard = {
  cardId: string;
  role: InstagramCarouselCardPlan["role"];
  beatIds: string[];
  beatMessages: InstagramCardCopyBeatMessage[];
  communicationGoal: string;
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
      });
    }
    return {
      cardId: card.cardId,
      role: card.role,
      beatIds: [...card.beatIds],
      beatMessages,
      communicationGoal: card.communicationGoal,
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
          "Advance to what changes (terrain / rhythm / direction).",
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
          "Recover prior-card payoff; prefer 2–4 lines.",
          "No new long explanation; not CTA by default.",
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
  return {
    task: "instagram_card_copy",
    editorialNarrativePlan: input.narrative,
    instagramCarouselPlan: input.carousel,
    cards: cards.map((card) => ({
      ...card,
      mobileDensity: mobileDensityGuidanceForRole(card.role),
    })),
    mobileDensityContract: {
      ...INSTAGRAM_CARD_COPY_MOBILE_DENSITY,
      principle:
        "Keep beat-scoped context density; compress verbal redundancy for mobile cardnews (~3–4 body lines soft target). Never retreat to abstract slogan-only summary.",
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
      ],
    },
    canonicalAsset: input.canonicalAsset,
  };
}
