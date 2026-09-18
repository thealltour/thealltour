/**
 * Per-channel workspace helpers after Canonical approve (no auto fan-out).
 * Empty slots are a normal lifecycle state, not a quality failure.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import {
  PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
  PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
  PUBLISHABLE_CHANNELS,
  formatForChannel,
  type PublishableChannel,
  type PublishableChannelContent,
  type PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import { resolveTargetPublishableChannels } from "@/lib/marketing/publishable/selectTargetChannels";

export function createNotGeneratedChannelContent(input: {
  channel: PublishableChannel;
  candidateId: string;
  sourceRevision: string;
  nowIso: string;
  commercialIntent?: string | null;
}): PublishableChannelContent {
  return {
    contract: PUBLISHABLE_CHANNEL_CONTENT_CONTRACT,
    channel: input.channel,
    format: formatForChannel(input.channel),
    title: null,
    body: "",
    status: "not_generated",
    generatedAt: input.nowIso,
    sourceCandidateId: input.candidateId,
    sourceRevision: input.sourceRevision,
    provenance: {
      composer: "deterministic_fallback",
      evidenceRefIds: [],
      commercialIntent: input.commercialIntent ?? null,
      generationMode: "skipped",
      modelProfile: null,
      attemptCount: 0,
      failureCategory: null,
      failureMessage: null,
    },
    validation: { ok: false, issues: [] },
    publishableSuccess: false,
    needsRegeneration: true,
    sourceAssetId: null,
    sourceAssetVersion: null,
    stale: false,
  };
}

export function isChannelNotGenerated(
  content: PublishableChannelContent | null | undefined,
): boolean {
  if (!content) return true;
  if (content.status === "not_generated") return true;
  return !content.body?.trim();
}

/**
 * Seed / refresh a publishable workspace after Canonical approve.
 * Never invokes composers — only placeholders + stale marking of prior bodies.
 */
export function buildChannelWorkspaceAfterCanonicalApprove(input: {
  candidateId: string;
  businessDateKst: string;
  sourceRevision: string;
  targetChannels?: PublishableChannel[] | null;
  contentPlanTargetChannels?: string[] | null;
  commercialIntent?: string | null;
  approvedAsset: CanonicalMarketingAsset;
  priorBundle?: PublishableContentBundle | null;
  nowIso: string;
}): PublishableContentBundle {
  const targetChannels = resolveTargetPublishableChannels({
    explicit: input.targetChannels ?? null,
    contentPlanTargetChannels: input.contentPlanTargetChannels ?? null,
  });
  const approvedVersion =
    input.approvedAsset.approvedVersion ?? input.approvedAsset.version;

  const slotFor = (channel: PublishableChannel): PublishableChannelContent => {
    const prior = input.priorBundle?.[channel];
    if (prior?.body?.trim()) {
      const sameAsset =
        prior.sourceAssetId === input.approvedAsset.assetId &&
        prior.sourceAssetVersion === approvedVersion;
      return {
        ...prior,
        stale: !sameAsset,
      };
    }
    return createNotGeneratedChannelContent({
      channel,
      candidateId: input.candidateId,
      sourceRevision: input.sourceRevision,
      nowIso: input.nowIso,
      commercialIntent: input.commercialIntent,
    });
  };

  const threads = slotFor("threads");
  const shortform = slotFor("shortform");
  const bundle: PublishableContentBundle = {
    contract: PUBLISHABLE_CONTENT_BUNDLE_CONTRACT,
    candidateId: input.candidateId,
    businessDateKst: input.businessDateKst,
    generatedAt: input.nowIso,
    sourceRevision: input.sourceRevision,
    targetChannels,
    threads,
    shortform,
    sourceAssetId: input.approvedAsset.assetId,
    sourceAssetVersion: approvedVersion,
    sourceAssetRevision: input.approvedAsset.sourceRevision,
  };

  for (const channel of PUBLISHABLE_CHANNELS) {
    if (channel === "threads" || channel === "shortform") continue;
    if (!targetChannels.includes(channel) && !input.priorBundle?.[channel]?.body?.trim()) {
      continue;
    }
    bundle[channel] = slotFor(channel);
  }

  return bundle;
}
