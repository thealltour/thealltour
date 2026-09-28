import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import type { ContentProposition } from "@/lib/marketing/content/proposition/contracts";
import {
  resolveStoryDecisionContext,
  resolveStoryEditorialArchetype,
} from "@/lib/marketing/canonicalAsset/revisions";
import type { StoryContentPoint } from "@/lib/marketing/storyPoint/contracts";

export type CanonicalHandoffStoryContext = {
  editorialArchetype: string | null;
  audienceTensionKo: string | null;
  decisionAtStakeKo: string | null;
  stakesKo: string[];
};

/**
 * Server-only (revisions imports node:crypto): resolves the read-only Story semantics
 * for the ChatGPT/Astra canonical handoff from the same sources the Canonical Writer uses.
 * Decision context is exposed only for decision/practical archetypes with structured
 * decision fields — audienceTension is never relabeled as a decision.
 */
export function resolveCanonicalHandoffStoryContext(input: {
  story: StoryContentPoint | null;
  proposition: Pick<ContentProposition, "audienceTension"> | null;
  asset: Pick<CanonicalMarketingAsset, "editorialArchetype"> | null;
}): CanonicalHandoffStoryContext {
  const { story, proposition, asset } = input;
  const editorialArchetype =
    (story ? resolveStoryEditorialArchetype(story) : null) ||
    asset?.editorialArchetype?.trim() ||
    null;
  const decision = story
    ? resolveStoryDecisionContext({
        editorialArchetype,
        agendaFitNotes: null,
        decisionAtStake: story.decisionAtStake,
        stakes: story.stakes,
      })
    : null;
  return {
    editorialArchetype,
    audienceTensionKo:
      proposition?.audienceTension?.trim() || story?.audienceTension?.trim() || null,
    decisionAtStakeKo: decision?.decisionAtStake ?? null,
    stakesKo: decision?.stakes ?? [],
  };
}
