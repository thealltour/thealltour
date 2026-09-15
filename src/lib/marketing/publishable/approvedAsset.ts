import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import type {
  PublishableChannel,
  PublishableChannelContent,
  PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";

const CHANNEL_KEYS: PublishableChannel[] = [
  "threads",
  "shortform",
  "naver_blog",
  "naver_band",
  "kakao_channel",
];

export function stampChannelFromApprovedAsset(
  content: PublishableChannelContent,
  asset: CanonicalMarketingAsset,
): PublishableChannelContent {
  return {
    ...content,
    sourceAssetId: asset.assetId,
    sourceAssetVersion: asset.approvedVersion ?? asset.version,
    stale: false,
  };
}

export function markPublishableBundleStaleForAsset(
  bundle: PublishableContentBundle,
  asset: CanonicalMarketingAsset,
): PublishableContentBundle {
  const approvedVersion = asset.approvedVersion ?? asset.version;
  const mark = (c: PublishableChannelContent | undefined): PublishableChannelContent | undefined => {
    if (!c) return c;
    if (c.sourceAssetVersion === approvedVersion && c.sourceAssetId === asset.assetId) {
      return { ...c, stale: false };
    }
    return { ...c, stale: true };
  };
  return {
    ...bundle,
    threads: mark(bundle.threads)!,
    shortform: mark(bundle.shortform)!,
    naver_blog: mark(bundle.naver_blog),
    naver_band: mark(bundle.naver_band),
    kakao_channel: mark(bundle.kakao_channel),
  };
}

export function listStaleChannels(bundle: PublishableContentBundle): PublishableChannel[] {
  const out: PublishableChannel[] = [];
  for (const key of CHANNEL_KEYS) {
    const slot = bundle[key];
    if (slot?.stale) out.push(key);
  }
  return out;
}

export function buildApprovedAssetPromptSlice(
  asset: CanonicalMarketingAsset | null | undefined,
): Record<string, unknown> | null {
  if (!asset || asset.status !== "approved") return null;
  return {
    contract: asset.contract,
    assetId: asset.assetId,
    approvedVersion: asset.approvedVersion,
    sourceRevision: asset.sourceRevision,
    titleKo: asset.titleKo,
    dekKo: asset.dekKo,
    openingHookKo: asset.openingHookKo,
    bodyKo: asset.bodyKo,
    keyTakeawaysKo: asset.keyTakeawaysKo,
    decisionGuidanceKo: asset.decisionGuidanceKo,
    optionalCtaIntentKo: asset.optionalCtaIntentKo,
    limitationsKo: asset.limitationsKo,
    forbiddenClaimsKo: asset.forbiddenClaimsKo,
    supportedClaimBoundaryKo: asset.supportedClaimBoundaryKo,
    unresolvedQuestionsKo: asset.unresolvedQuestionsKo,
    storyPointId: asset.storyPointId,
    storyPointHash: asset.storyPointHash,
    storySupportVerdict: asset.storySupportVerdict,
  };
}

export const APPROVED_ASSET_COMPOSER_RULES = [
  "APPROVED_CANONICAL_MARKETING_ASSET is the single source of truth for editorial content.",
  "Adapt tone/length/structure/CTA for this channel — do NOT invent a new Story or central thesis.",
  "Do NOT add unsupported facts, prices, routes, or causal claims absent from the approved asset.",
  "Do NOT exceed supportedClaimBoundaryKo. Never revive forbiddenClaimsKo.",
  "Do NOT use research details omitted from the approved asset to create a new angle.",
  "Retain provenance: sourceAssetId + sourceAssetVersion from the approved asset.",
].join("\n");
