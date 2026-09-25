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

/**
 * Full user payload for the Card Copy Writer oneshot.
 * Full Narrative + Carousel remain available; `cards` is the explicit per-card slice.
 */
export function buildInstagramCardCopyWriterPayload(input: {
  narrative: EditorialNarrativePlan;
  carousel: InstagramCarouselPlan;
  canonicalAsset: InstagramCardCopyCanonicalPromptSlice;
}): Record<string, unknown> {
  return {
    task: "instagram_card_copy",
    editorialNarrativePlan: input.narrative,
    instagramCarouselPlan: input.carousel,
    cards: buildInstagramCardCopyPromptCards({
      carousel: input.carousel,
      narrative: input.narrative,
    }),
    canonicalAsset: input.canonicalAsset,
  };
}
