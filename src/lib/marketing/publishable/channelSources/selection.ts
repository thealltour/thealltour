import {
  CHANNEL_SOURCE_SELECTION_CONTRACT,
  type ChannelEffectiveSource,
  type ChannelSourceSelectionFile,
  type ChannelSourceSelectionRecord,
  type ChannelSourceView,
} from "@/lib/marketing/publishable/channelSources/contracts";
import {
  readPackageJson,
  writeMutablePackageJson,
} from "@/lib/marketing/publishable/channelSources/packageIo";
import { CHANNEL_SOURCE_SELECTION_RELATIVE_PATH } from "@/lib/marketing/publishable/channelSources/paths";
import type {
  PublishableChannel,
  PublishableChannelContent,
  PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";

export function readChannelSourceSelection(packageRoot: string): ChannelSourceSelectionFile | null {
  const value = readPackageJson<ChannelSourceSelectionFile>(packageRoot, CHANNEL_SOURCE_SELECTION_RELATIVE_PATH);
  return value?.contract === CHANNEL_SOURCE_SELECTION_CONTRACT ? value : null;
}

export function writeChannelSourceSelectionRecord(input: {
  packageRoot: string;
  candidateId: string;
  channel: PublishableChannel;
  record: ChannelSourceSelectionRecord;
  nowIso: string;
}): ChannelSourceSelectionFile {
  const existing = readChannelSourceSelection(input.packageRoot);
  const next: ChannelSourceSelectionFile = {
    contract: CHANNEL_SOURCE_SELECTION_CONTRACT,
    candidateId: input.candidateId,
    updatedAt: input.nowIso,
    channels: { ...(existing?.channels ?? {}), [input.channel]: input.record },
  };
  writeMutablePackageJson(input.packageRoot, CHANNEL_SOURCE_SELECTION_RELATIVE_PATH, next, input.nowIso);
  return next;
}

/** What actually sits in the publishable slot right now (the slot is the source of truth). */
export function classifySlotSource(
  slot: PublishableChannelContent | null | undefined,
): ChannelEffectiveSource {
  if (slot?.provenance.generationSource === "external_editorial") return "external_editorial";
  if (slot?.provenance.composer === "human") return "human_edited";
  return "hermes_auto";
}

export const HERMES_REGENERATE_SELECTED_BY = "system:hermes_regenerate";
export const SELECTION_RECONCILE_SELECTED_BY = "system:reconcile";

function slotOf(
  bundle: PublishableContentBundle,
  channel: PublishableChannel,
): PublishableChannelContent | null {
  return bundle[channel] ?? null;
}

/**
 * Keeps channel-source-selection.json equal to the source that actually materialized each slot.
 * A successful Hermes write over an external slot flips the record to hermes_auto; a preserved
 * slot (failed regenerate) or a human edit leaves the record untouched. No-op without a selection file.
 */
export function reconcileChannelSourceSelection(input: {
  packageRoot: string;
  bundle: PublishableContentBundle;
  nowIso: string;
  selectedBy?: string;
}): { changedChannels: PublishableChannel[]; selection: ChannelSourceSelectionFile | null } {
  const existing = readChannelSourceSelection(input.packageRoot);
  if (!existing) return { changedChannels: [], selection: null };
  const channels = { ...existing.channels };
  const changedChannels: PublishableChannel[] = [];
  for (const [key, record] of Object.entries(existing.channels)) {
    if (!record) continue;
    const channel = key as PublishableChannel;
    const slot = slotOf(input.bundle, channel);
    const slotSource = classifySlotSource(slot);
    if (slotSource === "human_edited") continue;
    const slotRef = slot?.provenance.externalCandidateRef ?? null;
    if (
      slotSource === record.selectedSource &&
      (slotSource !== "external_editorial" || slotRef === record.candidateRef)
    ) {
      continue;
    }
    channels[channel] =
      slotSource === "external_editorial"
        ? {
            ...record,
            selectedSource: "external_editorial",
            candidateRef: slotRef,
            selectedAt: input.nowIso,
            selectedBy: SELECTION_RECONCILE_SELECTED_BY,
            materializedGeneratedAt: slot?.generatedAt ?? null,
          }
        : {
            selectedSource: "hermes_auto",
            candidateRef: null,
            assetId: slot?.sourceAssetId ?? record.assetId,
            assetVersion: slot?.sourceAssetVersion ?? record.assetVersion,
            selectedAt: input.nowIso,
            selectedBy: input.selectedBy ?? HERMES_REGENERATE_SELECTED_BY,
            materializedGeneratedAt: slot?.generatedAt ?? null,
            hermesSnapshotRef: null,
          };
    changedChannels.push(channel);
  }
  if (changedChannels.length === 0) return { changedChannels, selection: existing };
  const next: ChannelSourceSelectionFile = { ...existing, updatedAt: input.nowIso, channels };
  writeMutablePackageJson(input.packageRoot, CHANNEL_SOURCE_SELECTION_RELATIVE_PATH, next, input.nowIso);
  return { changedChannels, selection: next };
}

export function resolveChannelSourceView(input: {
  channel: PublishableChannel;
  record: ChannelSourceSelectionRecord | null | undefined;
  slot: PublishableChannelContent | null | undefined;
  humanDraftActive?: boolean;
}): ChannelSourceView {
  const record = input.record ?? null;
  const effectiveSource = classifySlotSource(input.slot);
  const selectedSource =
    effectiveSource === "human_edited" ? (record?.selectedSource ?? "hermes_auto") : effectiveSource;
  const externalCandidateRef =
    effectiveSource === "external_editorial" ? (input.slot?.provenance.externalCandidateRef ?? null) : null;
  const selectionInSync =
    effectiveSource === "human_edited" ||
    (record
      ? record.selectedSource === effectiveSource &&
        (effectiveSource !== "external_editorial" || record.candidateRef === externalCandidateRef)
      : effectiveSource === "hermes_auto");
  return {
    channel: input.channel,
    selectedSource,
    effectiveSource,
    externalCandidateRef,
    selectionInSync,
    humanDraftActive: Boolean(input.humanDraftActive),
    hermesSnapshotAvailable: Boolean(record?.hermesSnapshotRef),
  };
}
