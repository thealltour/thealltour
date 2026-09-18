/**
 * Build SharedVisualPlan from PublishableContentBundle.
 * Reassigns master social_visual_NN IDs; worker IDs are request-only.
 */

import { SOCIAL_VISUAL_ASSET_FAMILY } from "@/lib/marketing/publishable/socialVisualPlan";
import { stableSocialVisualId } from "@/lib/marketing/publishable/socialVisualPlan";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import {
  SHARED_VISUAL_PLAN_CONTRACT,
  type SharedVisual,
  type SharedVisualPlan,
  type SharedVisualUsage,
  type SocialVisualRequest,
} from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import { collectSocialVisualRequests } from "@/lib/marketing/publishable/sharedVisualPlan/collectRequests";
import { groupVisualRequests } from "@/lib/marketing/publishable/sharedVisualPlan/dedupe";
import { computePlanSourceFingerprintFromBundle } from "@/lib/marketing/publishable/sharedVisualPlan/fingerprint";
import { buildSourceChannelSnapshot } from "@/lib/marketing/publishable/sharedVisualPlan/sourceChannelSnapshot";

function resolveSourceMeta(bundle: PublishableContentBundle): {
  sourceAssetId: string;
  sourceAssetVersion: number;
} {
  const id =
    bundle.sourceAssetId?.trim() ||
    bundle.threads?.sourceAssetId?.trim() ||
    bundle.instagram?.sourceAssetId?.trim() ||
    bundle.candidateId ||
    "unknown_asset";
  const version =
    bundle.sourceAssetVersion ??
    bundle.threads?.sourceAssetVersion ??
    bundle.instagram?.sourceAssetVersion ??
    0;
  return {
    sourceAssetId: id,
    sourceAssetVersion: typeof version === "number" && Number.isFinite(version) ? version : 0,
  };
}

function pickPrimaryMember(members: SocialVisualRequest[]): SocialVisualRequest {
  // Prefer Instagram member for role/intent/mode richness; else first by order.
  const ig = members.find((m) => m.sourceChannel === "instagram");
  if (ig) return ig;
  return members[0]!;
}

function mergeGeneratedNeeded(members: SocialVisualRequest[]): boolean {
  return members.some((m) => m.generatedVisualNeeded);
}

function mergeUsages(members: SocialVisualRequest[]): SharedVisualUsage[] {
  const out: SharedVisualUsage[] = [];
  const seen = new Set<string>();
  for (const m of members) {
    const key =
      m.usage.channel === "threads"
        ? `threads:${m.usage.slotIndex}`
        : `instagram:${m.usage.cardId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(m.usage);
  }
  // Stable: instagram card usages first (by cardId), then threads slots.
  out.sort((a, b) => {
    if (a.channel !== b.channel) return a.channel === "instagram" ? -1 : 1;
    if (a.channel === "instagram" && b.channel === "instagram") {
      return a.cardId.localeCompare(b.cardId);
    }
    if (a.channel === "threads" && b.channel === "threads") {
      return a.slotIndex - b.slotIndex;
    }
    return 0;
  });
  return out;
}

function materializeGroup(members: SocialVisualRequest[], index1Based: number): SharedVisual {
  const primary = pickPrimaryMember(members);
  const intent =
    members
      .map((m) => m.visualIntent.trim())
      .filter(Boolean)
      .sort((a, b) => b.length - a.length || a.localeCompare(b))[0] ?? primary.visualIntent;
  const mode =
    members.map((m) => m.visualMode).find((m) => m != null) ?? primary.visualMode;

  return {
    visualId: stableSocialVisualId(index1Based),
    assetFamily: SOCIAL_VISUAL_ASSET_FAMILY,
    role: primary.role,
    visualIntent: intent,
    ...(mode ? { visualMode: mode } : {}),
    generatedVisualNeeded: mergeGeneratedNeeded(members),
    usages: mergeUsages(members),
  };
}

/**
 * Deterministic Shared Visual Plan builder.
 * Kept as labeled fallback / validator helper — not the primary operator path.
 */
export function buildSharedVisualPlan(input: {
  bundle: PublishableContentBundle;
  now?: Date;
  /** Default deterministic_fallback so UI can label non-LLM plans. */
  planningMode?: SharedVisualPlan["planningMode"];
}): SharedVisualPlan {
  const nowIso = (input.now ?? new Date()).toISOString();
  const { sourceAssetId, sourceAssetVersion } = resolveSourceMeta(input.bundle);
  const sourceChannelSnapshot = buildSourceChannelSnapshot(input.bundle);
  const fingerprint = computePlanSourceFingerprintFromBundle(input.bundle);
  const requests = collectSocialVisualRequests(input.bundle);
  const groups = groupVisualRequests(requests);
  const visuals = groups.map((g, i) => materializeGroup(g.members, i + 1));

  return {
    contract: SHARED_VISUAL_PLAN_CONTRACT,
    sourceAssetId,
    sourceAssetVersion,
    generatedAt: nowIso,
    sourceVisualPlanFingerprint: fingerprint,
    sourceChannelSnapshot,
    strategySummary: null,
    planningMode: input.planningMode ?? "deterministic_fallback",
    visuals,
  };
}
