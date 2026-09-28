import { resolveStoryEditorialArchetype } from "@/lib/marketing/canonicalAsset/revisions";
import { isDiscoveryLikeArchetype } from "@/lib/marketing/publishable/editorialArchetype";
import type { StoryContentPoint } from "@/lib/marketing/storyPoint/contracts";

/**
 * StoryPoint as serialized into LLM prompt payloads.
 * Discovery-like Stories keep an imported decisionAtStake / stakes as stored context only —
 * emitting them would hand the model a decision frame the Story does not have.
 */
export function projectStoryPointForPrompt(point: StoryContentPoint): StoryContentPoint {
  if (point.decisionAtStake == null && !point.stakes?.length) return point;
  if (!isDiscoveryLikeArchetype(resolveStoryEditorialArchetype(point))) return point;
  const projected: StoryContentPoint = { ...point };
  delete projected.decisionAtStake;
  delete projected.stakes;
  return projected;
}
