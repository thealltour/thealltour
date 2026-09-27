/**
 * Per-channel source switch: Hermes Auto ⇄ External Editorial.
 * Everything is validated/materialized in memory first; files are written only after that
 * succeeds (fail closed). Returns the review with the synced aiDraft — caller persists it.
 */

import type { CanonicalMarketingAsset } from "@/lib/marketing/canonicalAsset/contracts";
import { isApprovedCanonicalAsset } from "@/lib/marketing/canonicalAsset/validateCanonicalMarketingAsset";
import {
  CHANNEL_SOURCE_MESSAGES_KO,
  type ChannelGenerationSource,
  type ChannelSourceSelectionFile,
  type ChannelSourceView,
} from "@/lib/marketing/publishable/channelSources/contracts";
import { readExternalEditorialCandidate } from "@/lib/marketing/publishable/channelSources/externalCandidateStore";
import {
  captureHermesAutoSnapshot,
  readHermesAutoSnapshot,
} from "@/lib/marketing/publishable/channelSources/hermesAutoSnapshot";
import {
  ExternalChannelMaterializeError,
  externalChannelArtifact,
  materializeExternalChannel,
} from "@/lib/marketing/publishable/channelSources/materializeExternalChannel";
import {
  readPublishableBundle,
  removePackageFile,
  writeMutablePackageJson,
  writePublishableBundle,
} from "@/lib/marketing/publishable/channelSources/packageIo";
import { externalEditorialCandidateRelativePath } from "@/lib/marketing/publishable/channelSources/paths";
import {
  classifySlotSource,
  readChannelSourceSelection,
  resolveChannelSourceView,
  writeChannelSourceSelectionRecord,
} from "@/lib/marketing/publishable/channelSources/selection";
import type {
  PublishableChannel,
  PublishableChannelContent,
  PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";
import type { ChannelReviewEntry } from "@/lib/marketing/review/channelReviews";
import type { HumanMarketingReview } from "@/lib/marketing/review/types";

export type SelectChannelSourceInput = {
  packageRoot: string;
  candidateId: string;
  approvedCanonical: CanonicalMarketingAsset | null;
  channel: PublishableChannel;
  source: ChannelGenerationSource;
  importId?: string | null;
  selectedBy: string | null;
  allowOverwriteHuman: boolean;
  review: HumanMarketingReview;
  now?: Date;
};

export type SelectChannelSourceErrorCode =
  | "canonical_missing"
  | "canonical_not_approved"
  | "stale_identity"
  | "bundle_missing"
  | "candidate_missing"
  | "artifact_missing"
  | "channel_not_materializable"
  | "hermes_snapshot_missing"
  | "human_edited_channel_requires_confirm";

export type SelectChannelSourceResult =
  | {
      ok: true;
      /** False when the slot already held the requested source (selection record still updated). */
      changed: boolean;
      bundle: PublishableContentBundle;
      review: HumanMarketingReview;
      reviewChanged: boolean;
      selection: ChannelSourceSelectionFile;
      view: ChannelSourceView;
      warnings: string[];
    }
  | {
      ok: false;
      status: 404 | 409 | 422;
      code: SelectChannelSourceErrorCode;
      messageKo: string;
      details: string[];
    };

function fail(
  status: 404 | 409 | 422,
  code: SelectChannelSourceErrorCode,
  messageKo: string,
  details: string[] = [],
): SelectChannelSourceResult {
  return { ok: false, status, code, messageKo, details };
}

function getSlot(bundle: PublishableContentBundle, channel: PublishableChannel) {
  return bundle[channel] ?? null;
}

function withSlot(
  bundle: PublishableContentBundle,
  channel: PublishableChannel,
  slot: PublishableChannelContent | null,
  nowIso: string,
): PublishableContentBundle {
  const next: PublishableContentBundle = { ...bundle, generatedAt: nowIso };
  if (slot) {
    (next as Record<PublishableChannel, PublishableChannelContent | undefined>)[channel] = slot;
    if (!next.targetChannels.includes(channel)) {
      next.targetChannels = [...next.targetChannels, channel];
    }
  } else if (channel !== "threads" && channel !== "shortform") {
    delete next[channel];
  }
  return next;
}

function hasHumanDraft(review: HumanMarketingReview, channel: PublishableChannel): boolean {
  return Boolean(review.channelReviews?.[channel]?.humanDraft?.body?.trim());
}

export function syncReviewChannelAiDraft(input: {
  review: HumanMarketingReview;
  channel: PublishableChannel;
  slot: PublishableChannelContent | null;
  nowIso: string;
}): HumanMarketingReview {
  const prev = input.review.channelReviews?.[input.channel];
  const slot = input.slot;
  const entry: ChannelReviewEntry = {
    channel: input.channel,
    status: "needs_review",
    aiDraft: { title: slot?.title ?? null, body: slot?.body ?? "" },
    humanDraft: null,
    validationWarnings: !slot
      ? ["awaiting_generation"]
      : slot.validation.ok
        ? []
        : slot.validation.issues.map((i) => i.message).slice(0, 8),
    lastEditedAt: prev?.lastEditedAt ?? null,
    approvedAt: null,
    skippedAt: null,
    notes: prev?.notes ?? null,
    marketingValue: null,
  };
  return {
    ...input.review,
    channelReviews: { ...(input.review.channelReviews ?? {}), [input.channel]: entry },
    updatedAt: input.nowIso,
  };
}

function writeSidecars(packageRoot: string, sidecars: Record<string, unknown | null>, nowIso: string) {
  for (const [relativePath, value] of Object.entries(sidecars)) {
    if (value === null || value === undefined) removePackageFile(packageRoot, relativePath);
    else writeMutablePackageJson(packageRoot, relativePath, value, nowIso);
  }
}

export function selectChannelSource(input: SelectChannelSourceInput): SelectChannelSourceResult {
  const now = input.now ?? new Date();
  const nowIso = now.toISOString();
  const asset = input.approvedCanonical;
  if (!asset) return fail(409, "canonical_missing", CHANNEL_SOURCE_MESSAGES_KO.canonicalMissing);
  if (!isApprovedCanonicalAsset(asset)) {
    return fail(409, "canonical_not_approved", CHANNEL_SOURCE_MESSAGES_KO.canonicalNotApproved);
  }
  const bundle = readPublishableBundle(input.packageRoot);
  if (!bundle) return fail(409, "bundle_missing", CHANNEL_SOURCE_MESSAGES_KO.bundleMissing);

  const selectionFile = readChannelSourceSelection(input.packageRoot);
  const record = selectionFile?.channels[input.channel] ?? null;
  const currentSlot = getSlot(bundle, input.channel);
  const currentSource = classifySlotSource(currentSlot);
  // A human edit on top of an external selection still belongs to the external side.
  const slotBelongsToExternal =
    currentSource === "external_editorial" ||
    (currentSource === "human_edited" && record?.selectedSource === "external_editorial");
  const assetVersion = asset.approvedVersion ?? asset.version;

  if (input.source === "external_editorial") {
    const importId = input.importId ?? "";
    const candidate = importId ? readExternalEditorialCandidate(input.packageRoot, importId) : null;
    if (!candidate) return fail(404, "candidate_missing", CHANNEL_SOURCE_MESSAGES_KO.candidateMissing);
    const identityMismatch = [
      candidate.candidateId !== input.candidateId ? "candidateId" : null,
      candidate.assetId !== asset.assetId ? "assetId" : null,
      candidate.canonicalVersion !== asset.version ? "canonicalVersion" : null,
      candidate.sourceRevision !== asset.sourceRevision ? "sourceRevision" : null,
    ].filter((v): v is string => v !== null);
    if (identityMismatch.length > 0) {
      return fail(409, "stale_identity", CHANNEL_SOURCE_MESSAGES_KO.staleIdentity, identityMismatch);
    }
    if (externalChannelArtifact(candidate.result, input.channel) === null) {
      return fail(422, "artifact_missing", CHANNEL_SOURCE_MESSAGES_KO.channelNotMaterializable, [
        `${input.channel} 결과 없음`,
      ]);
    }
    if (hasHumanDraft(input.review, input.channel) && !input.allowOverwriteHuman) {
      return fail(409, "human_edited_channel_requires_confirm", CHANNEL_SOURCE_MESSAGES_KO.humanDraftConflict);
    }

    const candidateRef = externalEditorialCandidateRelativePath(candidate.importId);
    let materialized;
    try {
      materialized = materializeExternalChannel(
        {
          candidateId: input.candidateId,
          asset,
          result: candidate.result,
          externalNarrativeFingerprint: candidate.externalNarrativeFingerprint,
          externalCandidateRef: candidateRef,
          canonicalEvidenceIds: asset.evidenceRefs.map((e) => e.evidenceId),
          bundleSourceRevision: bundle.sourceRevision,
          priorSlot: currentSlot,
          nowIso,
          narrativeGeneratedAt: candidate.importedAt,
        },
        input.channel,
      );
    } catch (error) {
      const detail =
        error instanceof ExternalChannelMaterializeError
          ? `${error.code}: ${error.message}`
          : error instanceof Error
            ? error.message
            : String(error);
      return fail(422, "channel_not_materializable", CHANNEL_SOURCE_MESSAGES_KO.channelNotMaterializable, [
        detail,
      ]);
    }

    let hermesSnapshotRef = record?.hermesSnapshotRef ?? null;
    if (!slotBelongsToExternal) {
      hermesSnapshotRef = captureHermesAutoSnapshot({
        packageRoot: input.packageRoot,
        channel: input.channel,
        slot: currentSlot,
        nowIso,
      }).ref;
    }
    writeSidecars(input.packageRoot, materialized.sidecars, nowIso);
    const nextBundle = withSlot(bundle, input.channel, materialized.slot, nowIso);
    writePublishableBundle(input.packageRoot, nextBundle, nowIso);
    const selection = writeChannelSourceSelectionRecord({
      packageRoot: input.packageRoot,
      candidateId: input.candidateId,
      channel: input.channel,
      record: {
        selectedSource: "external_editorial",
        candidateRef,
        assetId: asset.assetId,
        assetVersion,
        selectedAt: nowIso,
        selectedBy: input.selectedBy,
        materializedGeneratedAt: materialized.slot.generatedAt,
        hermesSnapshotRef,
      },
      nowIso,
    });
    const review = syncReviewChannelAiDraft({
      review: input.review,
      channel: input.channel,
      slot: materialized.slot,
      nowIso,
    });
    return {
      ok: true,
      changed: true,
      bundle: nextBundle,
      review,
      reviewChanged: true,
      selection,
      view: resolveChannelSourceView({
        channel: input.channel,
        record: selection.channels[input.channel],
        slot: materialized.slot,
      }),
      warnings: materialized.warnings,
    };
  }

  // hermes_auto
  if (!slotBelongsToExternal) {
    const selection = writeChannelSourceSelectionRecord({
      packageRoot: input.packageRoot,
      candidateId: input.candidateId,
      channel: input.channel,
      record: {
        selectedSource: "hermes_auto",
        candidateRef: record?.selectedSource === "hermes_auto" ? record.candidateRef : null,
        assetId: asset.assetId,
        assetVersion,
        selectedAt: nowIso,
        selectedBy: input.selectedBy,
        materializedGeneratedAt: currentSlot?.generatedAt ?? null,
        hermesSnapshotRef: record?.hermesSnapshotRef ?? null,
      },
      nowIso,
    });
    return {
      ok: true,
      changed: false,
      bundle,
      review: input.review,
      reviewChanged: false,
      selection,
      view: resolveChannelSourceView({
        channel: input.channel,
        record: selection.channels[input.channel],
        slot: currentSlot,
        humanDraftActive: hasHumanDraft(input.review, input.channel),
      }),
      warnings: [],
    };
  }

  const snapshot = readHermesAutoSnapshot(input.packageRoot, record?.hermesSnapshotRef);
  if (!snapshot || snapshot.channel !== input.channel) {
    return fail(409, "hermes_snapshot_missing", CHANNEL_SOURCE_MESSAGES_KO.hermesSnapshotMissing);
  }
  if (hasHumanDraft(input.review, input.channel) && !input.allowOverwriteHuman) {
    return fail(409, "human_edited_channel_requires_confirm", CHANNEL_SOURCE_MESSAGES_KO.humanDraftConflict);
  }

  const restoredSlot: PublishableChannelContent | null = snapshot.slot
    ? {
        ...snapshot.slot,
        generatedAt: nowIso,
        provenance: {
          ...snapshot.slot.provenance,
          generationSource: "hermes_auto",
          externalCandidateRef: null,
        },
      }
    : null;
  writeSidecars(input.packageRoot, snapshot.sidecars, nowIso);
  const nextBundle = withSlot(bundle, input.channel, restoredSlot, nowIso);
  writePublishableBundle(input.packageRoot, nextBundle, nowIso);
  const selection = writeChannelSourceSelectionRecord({
    packageRoot: input.packageRoot,
    candidateId: input.candidateId,
    channel: input.channel,
    record: {
      selectedSource: "hermes_auto",
      candidateRef: record!.hermesSnapshotRef,
      assetId: asset.assetId,
      assetVersion,
      selectedAt: nowIso,
      selectedBy: input.selectedBy,
      materializedGeneratedAt: restoredSlot?.generatedAt ?? null,
      hermesSnapshotRef: record!.hermesSnapshotRef,
    },
    nowIso,
  });
  const review = syncReviewChannelAiDraft({
    review: input.review,
    channel: input.channel,
    slot: restoredSlot,
    nowIso,
  });
  return {
    ok: true,
    changed: true,
    bundle: nextBundle,
    review,
    reviewChanged: true,
    selection,
    view: resolveChannelSourceView({
      channel: input.channel,
      record: selection.channels[input.channel],
      slot: restoredSlot,
    }),
    warnings: [],
  };
}

export function listChannelSourceViews(
  packageRoot: string,
  review?: HumanMarketingReview | null,
): ChannelSourceView[] {
  const bundle = readPublishableBundle(packageRoot);
  const selection = readChannelSourceSelection(packageRoot);
  const channels: PublishableChannel[] = [
    "threads",
    "instagram",
    "naver_blog",
    "naver_band",
    "kakao_channel",
    "shortform",
  ];
  return channels.map((channel) =>
    resolveChannelSourceView({
      channel,
      record: selection?.channels[channel],
      slot: bundle ? getSlot(bundle, channel) : null,
      humanDraftActive: review ? hasHumanDraft(review, channel) : false,
    }),
  );
}
