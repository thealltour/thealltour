/**
 * Human Canonical Asset approval (authoritative source) + optional per-channel generate.
 * Canonical approve must NOT fan-out channel composers.
 */

import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

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
import {
  canValidateCanonicalAssetAgainstDomain,
  resolveCanonicalAssetDomainContext,
} from "@/lib/marketing/canonicalAsset/resolveCanonicalAssetDomainContext";
import {
  isApprovedCanonicalAsset,
  validateCanonicalMarketingAsset,
  type CanonicalAssetValidationIssue,
} from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import type { CompletedMarketingCandidate } from "@/lib/marketing/cron/daily/types";
import type { DailyMarketingRunRepository } from "@/lib/marketing/cron/daily/repository/createDailyMarketingRunRepository";
import {
  listStaleChannels,
  markPublishableBundleStaleForAsset,
} from "@/lib/marketing/publishable/approvedAsset";
import { buildChannelWorkspaceAfterCanonicalApprove } from "@/lib/marketing/publishable/channelWorkspace";
import { ensurePublishableContent } from "@/lib/marketing/publishable/ensurePublishableContent";
import { persistPublishableContentBundle } from "@/lib/marketing/publishable/persist";
import { PUBLISHABLE_CONTENT_RELATIVE_PATH } from "@/lib/marketing/publishable/paths";
import type {
  PublishableChannel,
  PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import type { PublishableLlmInvoke } from "@/lib/marketing/publishable/threads/composeThreadsPublishableContent";
import { mergeChannelReviewsFromPublishable } from "@/lib/marketing/review/mergeChannelReviews";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";
import { computePublishableSourceRevision } from "@/lib/marketing/publishable/inputs";

function tryReadBundle(packageRoot: string): PublishableContentBundle | null {
  const path = join(packageRoot, PUBLISHABLE_CONTENT_RELATIVE_PATH);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PublishableContentBundle;
  } catch {
    return null;
  }
}

function assertExpectedRevisionTokens(input: {
  existing: CanonicalMarketingAsset;
  expectedAssetId?: string;
  expectedVersion?: number;
  expectedSourceRevision?: string;
}): void {
  const { existing } = input;
  const hasAny =
    input.expectedAssetId != null ||
    input.expectedVersion != null ||
    input.expectedSourceRevision != null;
  if (!hasAny) return;
  if (
    (input.expectedAssetId != null && input.expectedAssetId !== existing.assetId) ||
    (input.expectedVersion != null && input.expectedVersion !== existing.version) ||
    (input.expectedSourceRevision != null &&
      input.expectedSourceRevision !== existing.sourceRevision)
  ) {
    throw new Error("canonical_asset_stale");
  }
}

function assertAssetPassesDomainValidation(input: {
  candidate: CompletedMarketingCandidate;
  asset: CanonicalMarketingAsset;
  packageRoot?: string | null;
  require: boolean;
}): CanonicalAssetValidationIssue[] | null {
  const ctx = resolveCanonicalAssetDomainContext({
    candidate: {
      ...input.candidate,
      canonicalMarketingAsset: input.asset,
    },
    packageRoot: input.packageRoot,
  });
  if (!canValidateCanonicalAssetAgainstDomain(ctx)) {
    if (input.require) {
      throw new Error("canonical_asset_validation_context_missing");
    }
    return null;
  }
  const check = validateCanonicalMarketingAsset({
    asset: input.asset,
    storyPoint: ctx.storyPoint,
    storyPointHash: ctx.storyPointHash,
    evidenceBrief: ctx.evidenceBrief,
    proposition: ctx.proposition,
    expectedSourceRevision: input.asset.sourceRevision,
  });
  if (!check.ok) {
    const err = new Error("canonical_asset_validation_failed") as Error & {
      issues?: CanonicalAssetValidationIssue[];
    };
    err.issues = check.issues;
    throw err;
  }
  return check.issues;
}

export async function saveCanonicalAssetHumanEdit(input: {
  candidate: CompletedMarketingCandidate;
  runRepo: DailyMarketingRunRepository;
  edits: CanonicalAssetEditFields;
  /** Optimistic concurrency tokens (ChatGPT import / stale protection). */
  expectedAssetId?: string;
  expectedVersion?: number;
  expectedSourceRevision?: string;
  /** When true, domain validation is mandatory (ChatGPT import). */
  requireDomainValidation?: boolean;
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
  assertExpectedRevisionTokens({
    existing,
    expectedAssetId: input.expectedAssetId,
    expectedVersion: input.expectedVersion,
    expectedSourceRevision: input.expectedSourceRevision,
  });
  const edited = applyHumanCanonicalAssetEdit({
    asset: existing,
    edits: input.edits,
    now: input.now,
  });
  assertAssetPassesDomainValidation({
    candidate: input.candidate,
    asset: edited,
    packageRoot: existsSync(packageRoot) ? packageRoot : null,
    require: Boolean(input.requireDomainValidation),
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
  const durableCandidate =
    saved.canonicalMarketingAsset?.version === edited.version
      ? saved
      : attachCanonicalAssetToCandidate(saved, edited);
  exportMarketingCandidatePackage({
    candidate: durableCandidate,
    assetRoot,
    now: input.now,
    overwriteArtifacts: true,
    publishableBundle: null,
    canonicalMarketingAsset: edited,
  });
  return { candidate: durableCandidate, asset: edited };
}

/**
 * Approve Canonical Marketing Asset as the authoritative downstream source.
 * Does NOT invoke channel composers / cardnews / shortform pipelines.
 */
export async function approveCanonicalAsset(input: {
  candidate: CompletedMarketingCandidate;
  runRepo: DailyMarketingRunRepository;
  mode: "ai_original" | "human_edited";
  approvedBy?: string | null;
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
  const nowIso = now.toISOString();
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
  try {
    assertAssetPassesDomainValidation({
      candidate: input.candidate,
      asset: existing,
      packageRoot,
      require: false,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "canonical_asset_validation_failed"
    ) {
      throw new Error("validation_failed_asset_cannot_approve");
    }
    throw error;
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
  if (candidate.canonicalMarketingAsset?.version !== approved.version) {
    candidate = attachCanonicalAssetToCandidate(candidate, approved);
  }

  const priorBundle = tryReadBundle(packageRoot);
  const sourceRevision = computePublishableSourceRevision(candidate, null, null, approved);
  const bundle = buildChannelWorkspaceAfterCanonicalApprove({
    candidateId: candidate.candidateId,
    businessDateKst: candidate.businessDateKst,
    sourceRevision,
    contentPlanTargetChannels: candidate.contentPlan?.targetChannels ?? null,
    commercialIntent: candidate.contentAssignment.commercialIntent,
    approvedAsset: approved,
    priorBundle,
    nowIso,
  });
  persistPublishableContentBundle({
    packageRoot,
    bundle,
    createdAt: nowIso,
  });

  try {
    exportMarketingCandidatePackage({
      candidate,
      assetRoot,
      now,
      overwriteArtifacts: true,
      publishableBundle: bundle,
      canonicalMarketingAsset: approved,
    });
  } catch {
    // Canonical + publishable workspace already persisted. Package export may fail on
    // incomplete legacy candidate shapes; do not undo approve.
  }

  let review = input.review ?? null;
  if (review) {
    review = {
      ...review,
      channelReviews: mergeChannelReviewsFromPublishable({
        existing: review.channelReviews,
        bundle,
      }),
      updatedAt: nowIso,
    };
  }

  return {
    candidate,
    asset: approved,
    bundle,
    staleChannels: listStaleChannels(bundle),
    review,
  };
}

/**
 * @deprecated Name kept for callers — behavior is approve-only (no channel fan-out).
 * Prefer `approveCanonicalAsset`.
 */
export async function approveCanonicalAssetAndGenerateChannels(input: {
  candidate: CompletedMarketingCandidate;
  runRepo: DailyMarketingRunRepository;
  mode: "ai_original" | "human_edited";
  approvedBy?: string | null;
  /** Ignored — retained for call-site compatibility. */
  invoke?: PublishableLlmInvoke | null;
  review?: HumanMarketingReview | null;
  now?: Date;
}): Promise<{
  candidate: CompletedMarketingCandidate;
  asset: CanonicalMarketingAsset;
  bundle: PublishableContentBundle;
  staleChannels: string[];
  review: HumanMarketingReview | null;
}> {
  return approveCanonicalAsset({
    candidate: input.candidate,
    runRepo: input.runRepo,
    mode: input.mode,
    approvedBy: input.approvedBy,
    review: input.review,
    now: input.now,
  });
}

/**
 * Explicit per-channel generate / regenerate. Never mutates Canonical or sibling channels' bodies.
 */
export async function generateChannelAsset(input: {
  candidate: CompletedMarketingCandidate;
  packageRoot: string;
  channel: PublishableChannel;
  invoke: PublishableLlmInvoke;
  approvedCanonicalAsset: CanonicalMarketingAsset;
  allowOverwriteHuman?: boolean;
  /** Prefer false in unit tests that mock legacy single-shot Instagram JSON. */
  useInstagramEditorialSplit?: boolean;
  qualityRevision?: {
    hints: string[];
    priorBody?: string | null;
    reasons?: string[];
  } | null;
  audienceContentResearchBrief?: Parameters<
    typeof ensurePublishableContent
  >[0]["audienceContentResearchBrief"];
  now?: Date;
}): Promise<PublishableContentBundle> {
  return ensurePublishableContent({
    candidate: input.candidate,
    packageRoot: input.packageRoot,
    forceRegenerateChannels: [input.channel],
    allowOverwriteHuman: Boolean(input.allowOverwriteHuman),
    allowDeterministicFallback: false,
    explicitTargetChannels: [
      ...(input.candidate.contentPlan?.targetChannels ?? []),
      input.channel,
    ],
    audienceContentResearchBrief: input.audienceContentResearchBrief,
    approvedCanonicalAsset: input.approvedCanonicalAsset,
    invoke: input.invoke,
    persist: true,
    qualityRevision: input.qualityRevision ?? null,
    useInstagramEditorialSplit: input.useInstagramEditorialSplit,
    now: input.now,
  });
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
