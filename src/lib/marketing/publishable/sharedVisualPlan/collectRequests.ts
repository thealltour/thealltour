/**
 * Collect SocialVisualRequest rows from a PublishableContentBundle.
 * Worker fields are ADVISORY hints for deterministic fallback only.
 * Shared Visual Planner LLM path does not use these as hard constraints.
 */

import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import type { SocialVisualRequest } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  defaultThreadsGeneratedVisualNeeded,
  normalizeSharedVisualMode,
} from "@/lib/marketing/publishable/sharedVisualPlan/normalize";

export function collectThreadsVisualRequests(
  bundle: PublishableContentBundle,
): SocialVisualRequest[] {
  const plan = bundle.threads?.mediaPlan;
  if (!plan) return [];
  // recommended=false is advisory — still collect explicit visual rows when present.
  // Empty visuals with recommended=false → no Threads hint requests.
  const visuals = Array.isArray(plan.visuals) ? plan.visuals : [];
  if (visuals.length === 0) return [];
  const out: SocialVisualRequest[] = [];
  for (let i = 0; i < visuals.length; i++) {
    const row = visuals[i];
    if (!row || typeof row !== "object") continue;
    const intent = typeof row.visualIntent === "string" ? row.visualIntent.trim() : "";
    const role = typeof row.role === "string" && row.role.trim() ? row.role.trim() : "cover_context";
    if (!intent && !role) continue;
    out.push({
      sourceChannel: "threads",
      sourceVisualId:
        typeof row.visualId === "string" && row.visualId.trim() ? row.visualId.trim() : undefined,
      role,
      visualIntent: intent,
      visualMode: undefined,
      // Advisory starting point for deterministic fallback only.
      generatedVisualNeeded: defaultThreadsGeneratedVisualNeeded({ role, visualIntent: intent }),
      // Stored for provenance; merge no longer requires this flag.
      reusableCrossChannel: Boolean(row.reusableOnInstagram),
      usage: { channel: "threads", slotIndex: i },
      orderKey: i,
    });
  }
  return out;
}

export function collectInstagramVisualRequests(
  bundle: PublishableContentBundle,
): SocialVisualRequest[] {
  const cards = bundle.instagram?.instagramMeta?.cardPlan;
  if (!Array.isArray(cards)) return [];
  const out: SocialVisualRequest[] = [];
  for (let i = 0; i < cards.length; i++) {
    const card = cards[i];
    if (!card || typeof card !== "object") continue;
    const visual = card.visual;
    if (!visual || typeof visual !== "object") continue;
    const cardId =
      typeof card.cardId === "string" && card.cardId.trim()
        ? card.cardId.trim()
        : `card-${String(i + 1).padStart(2, "0")}`;
    const role =
      typeof card.role === "string" && card.role.trim()
        ? card.role.trim()
        : typeof visual.visualMode === "string"
          ? "information"
          : "cover";
    const intent =
      (typeof visual.visualIntent === "string" && visual.visualIntent.trim()) ||
      (typeof card.visualIntent === "string" && card.visualIntent.trim()) ||
      "";
    out.push({
      sourceChannel: "instagram",
      sourceVisualId:
        typeof visual.visualId === "string" && visual.visualId.trim()
          ? visual.visualId.trim()
          : undefined,
      role,
      visualIntent: intent,
      visualMode: normalizeSharedVisualMode(visual.visualMode),
      // Advisory — deterministic fallback starting point only.
      generatedVisualNeeded: Boolean(visual.generatedVisualNeeded),
      reusableCrossChannel: Boolean(visual.reusableOnThreads),
      usage: { channel: "instagram", cardId },
      orderKey: i,
    });
  }
  return out;
}

/**
 * Stable request order for deterministic fallback:
 * 1) Instagram card order
 * 2) Threads slot order
 * Worker sourceVisualId never drives ordering or master IDs.
 */
export function collectSocialVisualRequests(
  bundle: PublishableContentBundle,
): SocialVisualRequest[] {
  const ig = collectInstagramVisualRequests(bundle);
  const th = collectThreadsVisualRequests(bundle);
  return [...ig, ...th];
}
