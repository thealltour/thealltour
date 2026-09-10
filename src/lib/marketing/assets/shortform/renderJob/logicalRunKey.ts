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
 * Deterministic idempotency key for a render intent.
 * Same candidate + brief + selection + profile → same key.
 */
export function buildShortformVideoRenderLogicalRunKey(input: {
  candidateId: string;
  briefSha256: string;
  selectionHash: string;
  renderProfile?: string;
}): string {
  const profile = input.renderProfile ?? SHORTFORM_VIDEO_RENDER_PROFILE_V1;
  const material = [
    input.candidateId.trim(),
    input.briefSha256.toLowerCase(),
    input.selectionHash.toLowerCase(),
    profile,
  ].join("|");
  const hash = createHash("sha256").update(material).digest("hex").slice(0, 24);
  return `${SHORTFORM_VIDEO_RENDER_LOGICAL_PREFIX}:${input.candidateId.trim()}:${hash}`;
}

export function createShortformVideoRenderJobId(logicalRunKey: string): string {
  return `svr_${createHash("sha256").update(logicalRunKey).digest("hex").slice(0, 24)}`;
}
