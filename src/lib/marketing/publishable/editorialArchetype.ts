/**
 * Channel-layer editorialArchetype helpers.
 * Reuses ASW Phase5 classification — do not invent a second taxonomy.
 */

import {
  isAsWDecisionPracticalArchetype,
  isAsWDiscoveryLikeArchetype,
  normalizeAswArchetypeKey,
} from "@/lib/marketing/canonicalAsset/prompt";

export type ChannelEditorialFamily = "discovery_like" | "decision_practical" | "unknown";

export {
  isAsWDecisionPracticalArchetype as isDecisionPracticalArchetype,
  isAsWDiscoveryLikeArchetype as isDiscoveryLikeArchetype,
  normalizeAswArchetypeKey,
};

export function resolveChannelEditorialFamily(
  archetype: string | null | undefined,
): ChannelEditorialFamily {
  if (isAsWDiscoveryLikeArchetype(archetype)) return "discovery_like";
  if (isAsWDecisionPracticalArchetype(archetype)) return "decision_practical";
  return "unknown";
}

/**
 * True only for explicit discovery-like archetypes.
 * Null/unknown must NOT loosen Marketing Value / quality scoring — only skip inventing decisionAtStake (via isDecisionPracticalArchetype).
 */
export function channelTreatAsDiscoveryLike(
  archetype: string | null | undefined,
): boolean {
  return resolveChannelEditorialFamily(archetype) === "discovery_like";
}

export function channelTreatAsDecisionPractical(
  archetype: string | null | undefined,
): boolean {
  return resolveChannelEditorialFamily(archetype) === "decision_practical";
}
