import { createHash } from "node:crypto";

import {
  SHORTFORM_VIDEO_RENDER_PROFILE_V1,
  type ShortformVideoRenderScenePickSnapshot,
} from "@/lib/marketing/assets/shortform/renderJob/contracts";

export const SHORTFORM_VIDEO_RENDER_LOGICAL_PREFIX = "shortform-video-render" as const;

export function buildShortformVideoRenderSelectionHash(
  scenePicks: ShortformVideoRenderScenePickSnapshot[],
): string {
  const normalized = [...scenePicks]
    .map((p) => ({
      sceneId: p.sceneId,
      sourceId: p.sourceId,
      origin: p.origin ?? "",
      rightsKind: p.rightsKind,
      factualMatch: p.factualMatch ?? "",
      mediaType: p.mediaType ?? "",
    }))
    .sort((a, b) => a.sceneId.localeCompare(b.sceneId));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/**
 * Narration text is read live from MediaBrief at render time and is not part of the
 * ShortVideoBrief, so it is fingerprinted separately to tell renders of edited text apart.
 */
export function buildShortformNarrationFingerprint(
  segments: ReadonlyArray<{ segmentId: string; narrationText: string; subtitleText: string }>,
): string {
  const normalized = segments.map((s) => ({
    segmentId: s.segmentId,
    narrationText: s.narrationText.trim(),
    subtitleText: s.subtitleText.trim(),
  }));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

/**
 * Deterministic idempotency key for a render intent.
 * Same candidate + brief + selection + profile (+ narration when known) → same key.
 */
export function buildShortformVideoRenderLogicalRunKey(input: {
  candidateId: string;
  briefSha256: string;
  selectionHash: string;
  renderProfile?: string;
  narrationSha256?: string | null;
}): string {
  const profile = input.renderProfile ?? SHORTFORM_VIDEO_RENDER_PROFILE_V1;
  const material = [
    input.candidateId.trim(),
    input.briefSha256.toLowerCase(),
    input.selectionHash.toLowerCase(),
    profile,
    // Omitted when unknown so keys of pre-existing jobs stay stable.
    ...(input.narrationSha256 ? [`narration:${input.narrationSha256.toLowerCase()}`] : []),
  ].join("|");
  const hash = createHash("sha256").update(material).digest("hex").slice(0, 24);
  return `${SHORTFORM_VIDEO_RENDER_LOGICAL_PREFIX}:${input.candidateId.trim()}:${hash}`;
}

export function createShortformVideoRenderJobId(logicalRunKey: string): string {
  return `svr_${createHash("sha256").update(logicalRunKey).digest("hex").slice(0, 24)}`;
}
