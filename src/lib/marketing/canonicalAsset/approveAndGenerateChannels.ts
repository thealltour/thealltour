/**
 * Human Canonical Asset approval + channel generation resume.
 */

import { existsSync, mkdirSync } from "node:fs";

import { resolveMarketingAssetRoot } from "@/lib/marketing/assets/config";
import { exportMarketingCandidatePackage } from "@/lib/marketing/assets/exportMarketingCandidatePackage";
import { ensurePackageLayout, resolvePackageDirectory } from "@/lib/marketing/assets/paths";
import {
  applyHumanCanonicalAssetEdit,
  approveCanonicalMarketingAsset,
  rejectCanonicalAsset,
  type CanonicalAssetEditFields,
} from "@/lib/marketing/canonicalAsset/humanAssetApproval";
import {
  attachCanonicalAssetToCandidate,
  persistCanonicalAssetToPackage,
  readCanonicalAssetFromPackage,
  resolveCanonicalMarketingAsset,
} from "@/lib/marketing/canonicalAsset/persistence";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import { ensurePublishableContent } from "@/lib/marketing/publishable/ensurePublishableContent";
import {
  markPublishableBundleStaleForAsset,
  listStaleChannels,
} from "@/lib/marketing/publishable/approvedAsset";
import { persistPublishableContentBundle } from "@/lib/marketing/publishable/persist";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import { mergeChannelReviewsFromPublishable } from "@/lib/marketing/review/mergeChannelReviews";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";

function tryReadBundle(packageRoot: string): PublishableContentBundle | null {
  const path = join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PublishableContentBundle;
  } catch {
    return null;
  }
}

export async function saveCanonicalAssetHumanEdit(input: {
  candidate: CompletedMarketingCandidate;
  runRepo: DailyMarketingRunRepository;
  edits: CanonicalAssetEditFields;
  now?: Date;
}): Promise<{ candidate: CompletedMarketingCandidate; asset: CanonicalMarketingAsset }> {
  const assetRoot = resolveMarketingAssetRoot({});
  const packageRoot = resolvePackageDirectory({
    assetRoot,
    businessDateKst: input.candidate.businessDateKst,
    candidateId: input.candidate.candidateId,
  });
  const existing =
    resolveCanonicalMarketingAsset({
      candidate: input.candidate,
      packageRoot: existsSync(packageRoot) ? packageRoot : null,
    }) ?? null;
  if (!existing) throw new Error("canonical_asset_missing");
  if (existing.status === "validation_failed") {
    throw new Error("validation_failed_asset_cannot_edit_until_regenerated");
  }
  const edited = applyHumanCanonicalAssetEdit({
    asset: existing,
    edits: input.edits,
    now: input.now,
  });
  persistCanonicalAssetToPackage({ packageRoot, asset: edited });
  const priorBundle = tryReadBundle(packageRoot);
  if (priorBundle && edited.version !== (priorBundle.sourceAssetVersion ?? null)) {
    const staleBundle = markPublishableBundleStaleForAsset(priorBundle, {
      ...edited,
      approvedVersion: edited.approvedVersion ?? edited.version,
    });
    persistPublishableContentBundle({
      packageRoot,
      bundle: staleBundle,
      createdAt: (input.now ?? new Date()).toISOString(),
    });
  }
  const candidate = attachCanonicalAssetToCandidate(input.candidate, edited);
  const saved = await input.runRepo.saveCandidate(candidate);
  exportMarketingCandidatePackage({
    candidate: saved,
    assetRoot,
    now: input.now,
    overwriteArtifacts: true,
    publishableBundle: null,
    canonicalMarketingAsset: edited,
  });
  return { candidate: saved, asset: edited };
}

export async function approveCanonicalAssetAndGenerateChannels(input: {
  candidate: CompletedMarketingCandidate;
  runRepo: DailyMarketingRunRepository;
  mode: "ai_original" | "human_edited";
  approvedBy?: string | null;
  invoke: PublishableLlmInvoke;
  review?: HumanMarketingReview | null;
  now?: Date;
}): Promise<{
  candidate: CompletedMarketingCandidate;
  asset: CanonicalMarketingAsset;
  bundle: PublishableContentBundle;
  staleChannels: string[];
  review: HumanMarketingReview | null;
}> {
  const now = input.now ?? new Date();
  const assetRoot = resolveMarketingAssetRoot({});
  const packageRoot = resolvePackageDirectory({
    assetRoot,
    businessDateKst: input.candidate.businessDateKst,
    candidateId: input.candidate.candidateId,
  });
  if (!existsSync(packageRoot)) {
    mkdirSync(packageRoot, { recursive: true });
    ensurePackageLayout(packageRoot);
  }
  const existing =
    resolveCanonicalMarketingAsset({
      candidate: input.candidate,
      packageRoot,
    }) ?? readCanonicalAssetFromPackage(packageRoot);
  if (!existing) throw new Error("canonical_asset_missing");
  if (existing.status === "validation_failed") {
    throw new Error("validation_failed_asset_cannot_approve");
  }

  const approved = approveCanonicalMarketingAsset({
    asset: existing,
    mode: input.mode,
    approvedBy: input.approvedBy ?? "human",
    now,
  });
  persistCanonicalAssetToPackage({ packageRoot, asset: approved });
  let candidate = attachCanonicalAssetToCandidate(input.candidate, approved);
  candidate = await input.runRepo.saveCandidate(candidate);

  const priorBundle = tryReadBundle(packageRoot);
  const priorVersion = priorBundle?.sourceAssetVersion ?? null;
  const forceAll =
    priorVersion !== null && priorVersion !== approved.approvedVersion;

  const bundle = await ensurePublishableContent({
    candidate,
    packageRoot,
    now,
    invoke: input.invoke,
    modelProfile: "content-strategist",
    approvedCanonicalAsset: approved,
    forceRegenerate: forceAll || !priorBundle,
    persist: true,
  });

  exportMarketingCandidatePackage({
    candidate,
    assetRoot,
    now,
    overwriteArtifacts: true,
    publishableBundle: bundle,
    canonicalMarketingAsset: approved,
  });

  let review = input.review ?? null;
  if (review) {
    review = {
      ...review,
      channelReviews: mergeChannelReviewsFromPublishable({
        existing: review.channelReviews,
        bundle,
      }),
      updatedAt: now.toISOString(),
    };
  }

  return {
    candidate,
    asset: approved,
    bundle,
    staleChannels: listStaleChannels(
      priorBundle && forceAll
        ? markPublishableBundleStaleForAsset(priorBundle, approved)
        : bundle,
    ),
    review,
  };
}

export function rejectCanonicalAssetForCandidate(input: {
  candidate: CompletedMarketingCandidate;
  reasonKo?: string | null;
  now?: Date;
}): { candidate: CompletedMarketingCandidate; asset: CanonicalMarketingAsset } {
  const existing = input.candidate.canonicalMarketingAsset;
  if (!existing) throw new Error("canonical_asset_missing");
  const rejected = rejectCanonicalAsset({
    asset: existing,
    reasonKo: input.reasonKo,
    now: input.now,
  });
  return {
    candidate: attachCanonicalAssetToCandidate(input.candidate, rejected),
    asset: rejected,
  };
}

export function assertChannelsRequireApprovedAsset(
  asset: CanonicalMarketingAsset | null | undefined,
): void {
  if (asset && !isApprovedCanonicalAsset(asset)) {
    throw new Error("canonical_asset_unapproved");
  }
}
