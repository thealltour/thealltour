/**
 * Shared Visual Plan fingerprint + stale detection.
 * Primary stale signal: sourceChannelSnapshot vs current publishable bundle.
 */

import { createHash } from "node:crypto";

import type { PublishableContentBundle } from "@/lib/marketing/publishable/contracts";
import type { SharedVisualPlan } from "@/lib/marketing/publishable/sharedVisualPlan/contracts";
import {
  buildSourceChannelSnapshot,
  computeSourceChannelSnapshotFingerprint,
  sourceChannelSnapshotsEqual,
  type SourceChannelSnapshot,
} from "@/lib/marketing/publishable/sharedVisualPlan/sourceChannelSnapshot";

function norm(text: string | null | undefined): string {
  return (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Legacy visual-planning-only payload (Threads mediaPlan + IG card visuals).
 * Kept for older tests / deterministic builder compatibility.
 */
export function buildVisualPlanFingerprintPayload(
  bundle: PublishableContentBundle,
): unknown {
  const threads = bundle.threads?.mediaPlan;
  const threadsPart =
    threads && threads.recommended
      ? {
          recommended: true,
          imageCount: threads.imageCount ?? 0,
          visuals: (threads.visuals ?? []).map((v, i) => ({
            i,
            sourceVisualId: v.visualId ?? null,
            role: norm(v.role),
            visualIntent: norm(v.visualIntent),
            reusableOnInstagram: Boolean(v.reusableOnInstagram),
          })),
        }
      : { recommended: false, visuals: [] as const };

  const cards = bundle.instagram?.instagramMeta?.cardPlan ?? [];
  const instagramPart = cards.map((card, i) => ({
    i,
    cardId: card.cardId ?? null,
    role: norm(card.role),
    cardVisualIntent: norm(card.visualIntent),
    visual: card.visual
      ? {
          sourceVisualId: card.visual.visualId ?? null,
          visualMode: norm(card.visual.visualMode),
          generatedVisualNeeded: Boolean(card.visual.generatedVisualNeeded),
          reusableOnThreads: Boolean(card.visual.reusableOnThreads),
          visualIntent: norm(card.visual.visualIntent),
        }
      : null,
  }));

  return {
    threads: threadsPart,
    instagram: instagramPart,
  };
}

/** @deprecated Prefer computePlanSourceFingerprintFromBundle (channel snapshot). */
export function computeVisualPlanFingerprint(bundle: PublishableContentBundle): string {
  const payload = buildVisualPlanFingerprintPayload(bundle);
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex").slice(0, 32);
}

/** Authoritative plan↔bundle fingerprint from full channel snapshot. */
export function computePlanSourceFingerprintFromBundle(
  bundle: PublishableContentBundle,
): string {
  return computeSourceChannelSnapshotFingerprint(buildSourceChannelSnapshot(bundle));
}

export function computePlanSourceFingerprintFromSnapshot(
  snapshot: SourceChannelSnapshot,
): string {
  return computeSourceChannelSnapshotFingerprint(snapshot);
}

export function isSharedVisualPlanStale(input: {
  planFingerprint: string | null | undefined;
  bundle: PublishableContentBundle;
  plan?: Pick<SharedVisualPlan, "sourceChannelSnapshot" | "sourceVisualPlanFingerprint"> | null;
}): boolean {
  if (input.plan?.sourceChannelSnapshot) {
    const current = buildSourceChannelSnapshot(input.bundle);
    return !sourceChannelSnapshotsEqual(input.plan.sourceChannelSnapshot, current);
  }
  if (!input.planFingerprint) return true;
  return computePlanSourceFingerprintFromBundle(input.bundle) !== input.planFingerprint;
}
