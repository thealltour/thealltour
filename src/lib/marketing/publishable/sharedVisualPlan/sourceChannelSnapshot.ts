/**
 * Source channel snapshot for Shared Visual Plan provenance + stale detection.
 * Version 2 tracks only the Instagram card structure the plan was built against: caption edits
 * and other channels never make the plan stale. Reviewed card copy drift is detected separately
 * through the Instagram Visual Role Plan (packageLifecycle). Snapshots without a version
 * (all-channel v1) never equal a v2 snapshot, so plans built before v2 read as stale.
 */

import { createHash } from "node:crypto";

import type {
  PublishableChannel,
  PublishableChannelContent,
  PublishableContentBundle,
} from "@/lib/marketing/publishable/contracts";

export const SOURCE_CHANNEL_SNAPSHOT_CHANNELS = [
  "threads",
  "instagram",
  "naver_blog",
  "naver_band",
  "kakao_channel",
  "shortform",
] as const satisfies readonly PublishableChannel[];

export type SourceChannelSnapshotKey = (typeof SOURCE_CHANNEL_SNAPSHOT_CHANNELS)[number];

export type SourceChannelSnapshotEntry = {
  present: boolean;
  revision: string | null;
  fingerprint: string | null;
  generatedAt: string | null;
  status: string | null;
};

export const SOURCE_CHANNEL_SNAPSHOT_VERSION = 2 as const;

export type SourceChannelSnapshot = {
  /** Absent on legacy all-channel snapshots. */
  version?: number;
  bundleSourceRevision: string;
  channels: Partial<Record<SourceChannelSnapshotKey, SourceChannelSnapshotEntry>>;
};

function norm(text: string | null | undefined): string {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

function hashPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex").slice(0, 32);
}

/**
 * Shared Visual Planner presence: channel content exists for planning input.
 * Body OR card structure is enough — do NOT require Worker visual hints.
 */
export function isChannelPresentForVisualPlanning(
  slot: PublishableChannelContent | null | undefined,
): boolean {
  if (!slot) return false;
  if (slot.status === "not_generated") return false;
  if (slot.body?.trim()) return true;
  if ((slot.instagramMeta?.cardPlan?.length ?? 0) > 0) return true;
  // needs_review / generated / validation_failed with empty body still absent
  return false;
}

/** @deprecated Use isChannelPresentForVisualPlanning — name kept for local callers. */
function isGeneratedChannel(slot: PublishableChannelContent | null | undefined): boolean {
  return isChannelPresentForVisualPlanning(slot);
}

/**
 * Per-channel content fingerprint — body + visual hints.
 * Body-only changes affect visual strategy, so include full channel text.
 */
export function computeChannelContentFingerprint(
  slot: PublishableChannelContent | null | undefined,
): string | null {
  if (!slot || !isGeneratedChannel(slot)) return null;
  const payload: Record<string, unknown> = {
    channel: slot.channel,
    sourceRevision: slot.sourceRevision ?? null,
    generatedAt: slot.generatedAt ?? null,
    title: norm(slot.title),
    body: norm(slot.body),
    status: slot.status ?? null,
    publishableSuccess: slot.publishableSuccess ?? null,
  };
  if (slot.channel === "threads") {
    const plan = slot.mediaPlan;
    payload.mediaPlan = plan
      ? {
          recommended: Boolean(plan.recommended),
          imageCount: plan.imageCount ?? 0,
          visuals: (plan.visuals ?? []).map((v, i) => ({
            i,
            role: norm(v.role),
            visualIntent: norm(v.visualIntent),
            reusableOnInstagram: Boolean(v.reusableOnInstagram),
          })),
        }
      : null;
  }
  if (slot.channel === "instagram") {
    payload.cardPlan = (slot.instagramMeta?.cardPlan ?? []).map((card, i) => ({
      i,
      cardId: card.cardId ?? null,
      role: norm(card.role),
      visualIntent: norm(card.visualIntent),
      visual: card.visual
        ? {
            visualMode: norm(card.visual.visualMode),
            generatedVisualNeeded: Boolean(card.visual.generatedVisualNeeded),
            visualIntent: norm(card.visual.visualIntent),
          }
        : null,
    }));
    payload.caption = norm(slot.body);
  }
  if (slot.channel === "naver_blog" && slot.blogMeta) {
    payload.blogMeta = {
      searchIntent: norm(slot.blogMeta.searchIntent),
      sectionPlan: (slot.blogMeta.sectionPlan ?? []).map(norm),
    };
  }
  if (slot.channel === "shortform" && slot.narrationSegments) {
    payload.narrationSegments = slot.narrationSegments.map((s, i) => ({
      i,
      segmentId: s.segmentId ?? null,
      narrationText: norm(s.narrationText),
      visualIntent: norm(s.visualIntent),
    }));
  }
  return hashPayload(payload);
}

/** Instagram card structure only — caption, generatedAt, and status are excluded on purpose. */
export function computeInstagramCardStructureFingerprint(
  slot: PublishableChannelContent | null | undefined,
): string | null {
  if (!slot || !isGeneratedChannel(slot)) return null;
  return hashPayload({
    channel: "instagram",
    cards: (slot.instagramMeta?.cardPlan ?? []).map((card, i) => ({
      i,
      cardId: card.cardId ?? null,
      role: norm(card.role),
      visualIntent: norm(card.visualIntent),
      visual: card.visual
        ? {
            visualMode: norm(card.visual.visualMode),
            generatedVisualNeeded: Boolean(card.visual.generatedVisualNeeded),
            visualIntent: norm(card.visual.visualIntent),
          }
        : null,
    })),
  });
}

export function buildSourceChannelSnapshot(
  bundle: PublishableContentBundle,
): SourceChannelSnapshot {
  const slot = bundle.instagram;
  const present = isGeneratedChannel(slot);
  return {
    version: SOURCE_CHANNEL_SNAPSHOT_VERSION,
    bundleSourceRevision: bundle.sourceRevision?.trim() || "",
    channels: {
      instagram: {
        present,
        revision: present ? (slot?.sourceRevision?.trim() || null) : null,
        fingerprint: present ? computeInstagramCardStructureFingerprint(slot) : null,
        generatedAt: null,
        status: null,
      },
    },
  };
}

export function computeSourceChannelSnapshotFingerprint(
  snapshot: SourceChannelSnapshot,
): string {
  return hashPayload(snapshot);
}

export function sourceChannelSnapshotsEqual(
  a: SourceChannelSnapshot | null | undefined,
  b: SourceChannelSnapshot | null | undefined,
): boolean {
  if (!a || !b) return false;
  return computeSourceChannelSnapshotFingerprint(a) === computeSourceChannelSnapshotFingerprint(b);
}

export function parseSourceChannelSnapshot(raw: unknown): SourceChannelSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const bundleSourceRevision =
    typeof row.bundleSourceRevision === "string" ? row.bundleSourceRevision.trim() : "";
  const version = typeof row.version === "number" && Number.isFinite(row.version) ? row.version : undefined;
  const channelsRaw =
    row.channels && typeof row.channels === "object"
      ? (row.channels as Record<string, unknown>)
      : {};
  const channels: SourceChannelSnapshot["channels"] = {};
  for (const key of SOURCE_CHANNEL_SNAPSHOT_CHANNELS) {
    const entry = channelsRaw[key];
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    channels[key] = {
      present: Boolean(e.present),
      revision: typeof e.revision === "string" ? e.revision : null,
      fingerprint: typeof e.fingerprint === "string" ? e.fingerprint : null,
      generatedAt: typeof e.generatedAt === "string" ? e.generatedAt : null,
      status: typeof e.status === "string" ? e.status : null,
    };
  }
  return { ...(version !== undefined ? { version } : {}), bundleSourceRevision, channels };
}

export function isLegacySourceChannelSnapshot(snapshot: SourceChannelSnapshot | null | undefined): boolean {
  return Boolean(snapshot) && snapshot!.version !== SOURCE_CHANNEL_SNAPSHOT_VERSION;
}
