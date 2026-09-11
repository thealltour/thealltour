import "server-only";

import { existsSync, readFileSync } from "node:fs";

import type { MediaBrief, ShortformNarrationSegment } from "@/lib/marketing/assets/contracts";
import { parseMediaBrief } from "@/lib/marketing/assets/parse";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { MEDIA_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import type { ShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/contracts";
import { SHORT_VIDEO_BRIEF_RELATIVE_PATH } from "@/lib/marketing/assets/shortVideoBrief/paths";
import { parseShortVideoBrief } from "@/lib/marketing/assets/shortVideoBrief/validate";
import type { ShortformVideoRenderJob } from "@/lib/marketing/assets/shortform/renderJob/contracts";
import { ShortformProductionError } from "@/lib/marketing/assets/shortform/production/errors";
import type { ShortformNarrationSegmentInput } from "@/lib/marketing/assets/shortform/production/narration";
import { resolveTtsProfile } from "@/lib/marketing/tts/profiles";
import type { MarketingAssetTransport } from "@/lib/marketing/assets/transport/contracts";
import { MarketingAssetTransportError } from "@/lib/marketing/assets/transport/errors";

const DEFAULT_VOICE_PROFILE_ID = "standard-ko-development";

export type ResolvedShortformNarrationPlan = {
  segments: ShortformNarrationSegmentInput[];
  /** Scene id → ordered subtitle texts (from MediaBrief.subtitleText). */
  subtitlesBySceneId: Record<string, string[]>;
  cta: string | null;
};

function readJsonArtifact(packageRoot: string, relativePath: string, missingCode: string): unknown {
  const absolutePath = resolvePackageArtifactPath({ packageRoot, relativePath });
  if (!existsSync(absolutePath)) {
    throw new ShortformProductionError(`${relativePath} missing`, missingCode);
  }
  try {
    return JSON.parse(readFileSync(absolutePath, "utf8")) as unknown;
  } catch {
    throw new ShortformProductionError(`${relativePath} is not valid JSON`, "PACKAGE_ARTIFACT_INVALID_JSON");
  }
}

export function readMediaBriefForShortformProduction(packageRoot: string): MediaBrief {
  return parseMediaBrief(
    readJsonArtifact(packageRoot, MEDIA_BRIEF_RELATIVE_PATH, "MEDIA_BRIEF_MISSING"),
  );
}

export function readShortVideoBriefForShortformProduction(packageRoot: string): ShortVideoBrief {
  return parseShortVideoBrief(
    readJsonArtifact(packageRoot, SHORT_VIDEO_BRIEF_RELATIVE_PATH, "SHORT_VIDEO_BRIEF_MISSING"),
  );
}

function indexNarrationSegments(mediaBrief: MediaBrief): Map<string, ShortformNarrationSegment> {
  const map = new Map<string, ShortformNarrationSegment>();
  for (const segment of mediaBrief.formats.shortform.narrationSegments) {
    map.set(segment.segmentId, segment);
  }
  return map;
}

function ttsProfileFields(voiceProfileId: string | null): ShortformNarrationSegmentInput["profile"] {
  const profile = resolveTtsProfile(voiceProfileId?.trim() || DEFAULT_VOICE_PROFILE_ID);
  return {
    provider: "voicestudio",
    profileId: profile.profileId,
    modelRef: profile.modelRef ?? "tts-1",
    voiceRef: profile.voiceRef ?? "default",
  };
}

/**
 * Resolve ShortVideoBrief narrationSegmentRefs → MediaBrief narrationSegments (SoT text).
 * Deterministic: scene order from ShortVideoBrief.order, refs in declared array order.
 * No placeholder / visual.subject / purpose fallback.
 */
export function resolveShortformNarrationPlan(input: {
  mediaBrief: MediaBrief;
  shortVideoBrief: ShortVideoBrief;
  /** When set, only these sceneIds (job scenePicks order) are included. */
  sceneIds: string[];
}): ResolvedShortformNarrationPlan {
  const byId = indexNarrationSegments(input.mediaBrief);
  const scenesById = new Map(input.shortVideoBrief.scenes.map((s) => [s.sceneId, s]));
  const profile = ttsProfileFields(
    input.shortVideoBrief.narration.voiceProfileId ??
      input.mediaBrief.formats.shortform.voiceProfileId,
  );

  const segments: ShortformNarrationSegmentInput[] = [];
  const subtitlesBySceneId: Record<string, string[]> = {};

  for (const sceneId of input.sceneIds) {
    const scene = scenesById.get(sceneId);
    if (!scene) {
      throw new ShortformProductionError(
        `scene ${sceneId} missing from ShortVideoBrief`,
        "SCENE_NOT_IN_BRIEF",
      );
    }
    const sceneSubtitles: string[] = [];
    for (const ref of scene.narrationSegmentRefs) {
      const source = byId.get(ref);
      if (!source) {
        throw new ShortformProductionError(
          `narration segment not found: ${ref}`,
          "NARRATION_SEGMENT_NOT_FOUND",
        );
      }
      const narrationText = source.narrationText.trim();
      if (!narrationText) {
        throw new ShortformProductionError(
          `narration text empty for segment ${ref}`,
          "NARRATION_TEXT_EMPTY",
        );
      }
      const subtitleText = (source.subtitleText.trim() || narrationText);
      segments.push({
        segmentId: source.segmentId,
        sceneId,
        text: narrationText,
        subtitleText,
        profile,
      });
      sceneSubtitles.push(subtitleText);
    }
    subtitlesBySceneId[sceneId] = sceneSubtitles;
  }

  return {
    segments,
    subtitlesBySceneId,
    cta:
      input.shortVideoBrief.narration.cta ??
      input.mediaBrief.formats.shortform.cta ??
      null,
  };
}

/** Production default: load package artifacts and resolve for job scenePicks. */
export function resolveShortformNarrationPlanForJob(input: {
  packageRoot: string;
  job: ShortformVideoRenderJob;
  mediaBrief?: MediaBrief;
  shortVideoBrief?: ShortVideoBrief;
}): ResolvedShortformNarrationPlan {
  const mediaBrief =
    input.mediaBrief ?? readMediaBriefForShortformProduction(input.packageRoot);
  const shortVideoBrief =
    input.shortVideoBrief ?? readShortVideoBriefForShortformProduction(input.packageRoot);
  const sceneIds = input.job.inputSnapshot.scenePicks.map((p) => p.sceneId);
  return resolveShortformNarrationPlan({ mediaBrief, shortVideoBrief, sceneIds });
}

/**
 * Transport-aware narration resolution (local FS or Pi Asset Transfer HTTP).
 * Mini-PC HTTP mode must not require MARKETING_ASSET_ROOT.
 */
export async function resolveShortformNarrationPlanViaTransport(input: {
  transport: MarketingAssetTransport;
  job: ShortformVideoRenderJob;
  signal?: AbortSignal;
}): Promise<ResolvedShortformNarrationPlan> {
  try {
    const mediaArtifact = await input.transport.readCandidatePackageArtifact({
      candidateId: input.job.candidateId,
      businessDateKst: input.job.businessDateKst,
      artifactKind: "media-brief",
      signal: input.signal,
    });
    const shortArtifact = await input.transport.readCandidatePackageArtifact({
      candidateId: input.job.candidateId,
      businessDateKst: input.job.businessDateKst,
      artifactKind: "short-video-brief",
      signal: input.signal,
    });
    const mediaBrief = parseMediaBrief(JSON.parse(mediaArtifact.bytes.toString("utf8")) as unknown);
    const shortVideoBrief = parseShortVideoBrief(
      JSON.parse(shortArtifact.bytes.toString("utf8")) as unknown,
    );
    const sceneIds = input.job.inputSnapshot.scenePicks.map((p) => p.sceneId);
    return resolveShortformNarrationPlan({ mediaBrief, shortVideoBrief, sceneIds });
  } catch (error) {
    if (error instanceof ShortformProductionError) throw error;
    if (error instanceof MarketingAssetTransportError) {
      throw new ShortformProductionError(error.message, error.code);
    }
    throw error;
  }
}
