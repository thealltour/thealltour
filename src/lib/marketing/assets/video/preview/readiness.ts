import { existsSync, readFileSync } from "node:fs";

import { VideoClipError, VideoPreviewError, VideoShotError } from "@/lib/marketing/assets/errors";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { assertShotListMatchesTimeline } from "@/lib/marketing/assets/video/map";
import { AI_VIDEO_SHOT_LIST_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import {
  VIDEO_CLIP_INTAKE_CONTRACT,
  VIDEO_CLIP_INTAKE_RELATIVE_PATH,
  videoClipIntakeSchema,
  type VideoClipIntake,
} from "@/lib/marketing/assets/video/intake/contracts";
import { readAiVideoShotListFromPackage } from "@/lib/marketing/assets/video/intake/inspect";
import { VIDEO_PREVIEW_PROFILE } from "@/lib/marketing/assets/video/preview/profile";
import { buildPreviewFilterComplex } from "@/lib/marketing/assets/video/preview/graph";
import {
  VIDEO_PREVIEW_COMPOSITION_CONTRACT,
  VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
  VIDEO_PREVIEW_RELATIVE_PATH,
  type VideoPreviewComposition,
  type VideoPreviewNarration,
  type VideoPreviewSource,
} from "@/lib/marketing/assets/video/preview/contracts";
import { revalidateIncomingClip, revalidateNarrationWav } from "@/lib/marketing/assets/video/preview/sources";
import { TtsError } from "@/lib/marketing/tts/errors";
import { renderSrtFromTimeline, TTS_SUBTITLES_RELATIVE_PATH } from "@/lib/marketing/tts/subtitles/render";
import { readAudioMasterTimelineFromPackage } from "@/lib/marketing/tts/subtitles/orchestrate";
import { TTS_TIMELINE_RELATIVE_PATH, type AudioMasterTimeline } from "@/lib/marketing/tts/timeline/contracts";
import type { AiVideoShotList } from "@/lib/marketing/assets/video/contracts";

export type VideoPreviewPlan = {
  candidateId: string;
  timeline: AudioMasterTimeline;
  shotList: AiVideoShotList;
  intake: VideoClipIntake;
  totalDurationMs: number;
  sources: VideoPreviewSource[];
  narration: VideoPreviewNarration[];
  sourceAbsolutePaths: string[];
  narrationAbsolutePaths: string[];
  subtitlesAbsolutePath: string;
  filterShots: Array<{
    absolutePath: string;
    targetStartMs: number;
    targetDurationMs: number;
    gapAfterMs: number;
  }>;
  filterNarration: Array<{ absolutePath: string; startMs: number; durationMs: number }>;
};

export type VideoPreviewReadiness =
  | { ready: false; code: "clip_intake_missing"; reason: string }
  | { ready: true; plan: VideoPreviewPlan };

function wrapPreviewError(error: unknown): never {
  if (error instanceof VideoPreviewError) throw error;
  if (error instanceof VideoClipError) {
    if (error.code === "shot_list_missing") {
      throw new VideoPreviewError("shot_list_missing", error.message);
    }
    throw new VideoPreviewError("inconsistent_package", error.message);
  }
  if (error instanceof VideoShotError) {
    throw new VideoPreviewError("inconsistent_package", error.message);
  }
  if (error instanceof TtsError) {
    if (error.code === "timeline_missing") {
      throw new VideoPreviewError("timeline_missing", error.message);
    }
    throw new VideoPreviewError("inconsistent_package", error.message);
  }
  throw error;
}

export function readClipIntakeFromPackage(packageRoot: string): VideoClipIntake | null {
  const absolutePath = resolvePackageArtifactPath({
    packageRoot,
    relativePath: VIDEO_CLIP_INTAKE_RELATIVE_PATH,
  });
  if (!existsSync(absolutePath)) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    throw new VideoPreviewError("clip_intake_invalid", "reel/clip-intake.json is not valid JSON");
  }
  if (typeof parsed === "object" && parsed !== null && "contract" in parsed) {
    const contract = (parsed as { contract: unknown }).contract;
    if (contract !== VIDEO_CLIP_INTAKE_CONTRACT) {
      throw new VideoPreviewError("clip_intake_invalid", "Clip intake contract must be video-clip-intake-v1");
    }
  }
  const intake = videoClipIntakeSchema.safeParse(parsed);
  if (!intake.success || intake.data.complete !== true) {
    throw new VideoPreviewError("clip_intake_invalid", "video-clip-intake-v1 is incomplete or malformed");
  }
  return intake.data;
}

function assertSubtitlesMatchTimeline(packageRoot: string, timeline: AudioMasterTimeline): string {
  const absolutePath = resolvePackageArtifactPath({
    packageRoot,
    relativePath: TTS_SUBTITLES_RELATIVE_PATH,
  });
  if (!existsSync(absolutePath)) {
    throw new VideoPreviewError("subtitles_missing", "reel/subtitles.srt is required before composing a preview");
  }
  const expected = Buffer.from(renderSrtFromTimeline(timeline), "utf8");
  const existing = readFileSync(absolutePath);
  if (sha256Buffer(existing) !== sha256Buffer(expected) || existing.equals(expected) === false) {
    throw new VideoPreviewError("stale_subtitles", "reel/subtitles.srt does not match the current timeline");
  }
  return absolutePath;
}

function assertIntakeMatchesShots(intake: VideoClipIntake, shotList: AiVideoShotList): VideoClipIntake["clips"] {
  if (intake.clips.length !== shotList.shots.length) {
    throw new VideoPreviewError("inconsistent_package", "Clip intake count must match the shot list");
  }
  const byShotId = new Map(intake.clips.map((clip) => [clip.shotId, clip]));
  return shotList.shots.map((shot) => {
    const clip = byShotId.get(shot.shotId);
    if (!clip) {
      throw new VideoPreviewError("inconsistent_package", `Clip intake is missing ${shot.shotId}`);
    }
    if (clip.ordinal !== shot.ordinal) {
      throw new VideoPreviewError("inconsistent_package", "Clip intake ordinals must match the shot list");
    }
    if (
      clip.targetStartMs !== shot.startMs ||
      clip.targetEndMs !== shot.endMs ||
      clip.targetDurationMs !== shot.durationMs
    ) {
      throw new VideoPreviewError("inconsistent_package", "Clip intake target timing must copy the shot list");
    }
    return clip;
  });
}

export function inspectVideoPreviewReadiness(packageRoot: string): VideoPreviewReadiness {
  const intake = readClipIntakeFromPackage(packageRoot);
  if (!intake) {
    return {
      ready: false,
      code: "clip_intake_missing",
      reason: "reel/clip-intake.json is required before composing a preview",
    };
  }

  try {
    const timeline = readAudioMasterTimelineFromPackage(packageRoot);
    const shotList = readAiVideoShotListFromPackage(packageRoot);
    if (intake.candidateId !== timeline.candidateId || shotList.candidateId !== timeline.candidateId) {
      throw new VideoPreviewError("inconsistent_package", "candidateId must match across timeline, shot list, and clip intake");
    }
    assertShotListMatchesTimeline(shotList, timeline);
    for (const [index, shot] of shotList.shots.entries()) {
      const segment = timeline.segments[index];
      if (!segment || shot.narrationSegmentId !== segment.segmentId) {
        throw new VideoPreviewError("inconsistent_package", "Shot narrationSegmentId must match the timeline segmentId");
      }
    }
    const lastSegment = timeline.segments[timeline.segments.length - 1];
    if (!lastSegment || timeline.totalDurationMs !== lastSegment.endMs) {
      throw new VideoPreviewError("inconsistent_package", "timeline.totalDurationMs must equal the last segment endMs");
    }
    const orderedClips = assertIntakeMatchesShots(intake, shotList);
    const subtitlesAbsolutePath = assertSubtitlesMatchTimeline(packageRoot, timeline);

    const sources: VideoPreviewSource[] = [];
    const sourceAbsolutePaths: string[] = [];
    const filterShots: VideoPreviewPlan["filterShots"] = [];
    const narration: VideoPreviewNarration[] = [];
    const narrationAbsolutePaths: string[] = [];
    const filterNarration: VideoPreviewPlan["filterNarration"] = [];

    for (const [index, shot] of shotList.shots.entries()) {
      const clip = orderedClips[index];
      if (!clip) {
        throw new VideoPreviewError("inconsistent_package", `Clip intake is missing ${shot.shotId}`);
      }
      const validated = revalidateIncomingClip({ packageRoot, clip });
      sources.push({
        shotId: shot.shotId,
        sourceRelativePath: clip.sourceRelativePath,
        sourceSha256: validated.sha256,
        targetStartMs: shot.startMs,
        targetEndMs: shot.endMs,
        targetDurationMs: shot.durationMs,
      });
      sourceAbsolutePaths.push(validated.absolutePath);
      const next = shotList.shots[index + 1];
      filterShots.push({
        absolutePath: validated.absolutePath,
        targetStartMs: shot.startMs,
        targetDurationMs: shot.durationMs,
        gapAfterMs: next ? next.startMs - shot.endMs : 0,
      });
    }

    for (const segment of timeline.segments) {
      const validated = revalidateNarrationWav({ packageRoot, segment });
      narration.push({
        segmentId: segment.segmentId,
        relativeAudioPath: segment.relativeAudioPath,
        audioSha256: validated.sha256,
        startMs: segment.startMs,
        endMs: segment.endMs,
        durationMs: segment.durationMs,
      });
      narrationAbsolutePaths.push(validated.absolutePath);
      filterNarration.push({
        absolutePath: validated.absolutePath,
        startMs: segment.startMs,
        durationMs: segment.durationMs,
      });
    }

    return {
      ready: true,
      plan: {
        candidateId: timeline.candidateId,
        timeline,
        shotList,
        intake,
        totalDurationMs: timeline.totalDurationMs,
        sources,
        narration,
        sourceAbsolutePaths,
        narrationAbsolutePaths,
        subtitlesAbsolutePath,
        filterShots,
        filterNarration,
      },
    };
  } catch (error) {
    wrapPreviewError(error);
  }
}

export function compositionIdentityFromPlan(
  plan: VideoPreviewPlan,
  preview: { sha256: string; byteSize: number },
): VideoPreviewComposition {
  return {
    contract: VIDEO_PREVIEW_COMPOSITION_CONTRACT,
    candidateId: plan.candidateId,
    timelineRelativePath: TTS_TIMELINE_RELATIVE_PATH,
    shotListRelativePath: AI_VIDEO_SHOT_LIST_RELATIVE_PATH,
    clipIntakeRelativePath: VIDEO_CLIP_INTAKE_RELATIVE_PATH,
    subtitlesRelativePath: TTS_SUBTITLES_RELATIVE_PATH,
    previewRelativePath: VIDEO_PREVIEW_RELATIVE_PATH,
    totalDurationMs: plan.totalDurationMs,
    profile: {
      width: VIDEO_PREVIEW_PROFILE.width,
      height: VIDEO_PREVIEW_PROFILE.height,
      fps: VIDEO_PREVIEW_PROFILE.fps,
      videoCodec: VIDEO_PREVIEW_PROFILE.videoCodec,
      audioCodec: VIDEO_PREVIEW_PROFILE.audioCodec,
      audioSampleRate: VIDEO_PREVIEW_PROFILE.audioSampleRate,
      gapPolicy: VIDEO_PREVIEW_PROFILE.gapPolicy,
      subtitleMode: VIDEO_PREVIEW_PROFILE.subtitleMode,
    },
    sources: plan.sources,
    narration: plan.narration,
    previewSha256: preview.sha256,
    previewByteSize: preview.byteSize,
  };
}

export function publicPreviewPlan(plan: VideoPreviewPlan): Record<string, unknown> {
  return {
    candidateId: plan.candidateId,
    totalDurationMs: plan.totalDurationMs,
    profile: VIDEO_PREVIEW_PROFILE,
    sources: plan.sources,
    narration: plan.narration,
    gapsMs: plan.filterShots.map((shot) => shot.gapAfterMs),
    filterComplex: buildPreviewFilterComplex({
      shots: plan.filterShots,
      narration: plan.filterNarration,
      totalDurationMs: plan.totalDurationMs,
    }),
    previewRelativePath: VIDEO_PREVIEW_RELATIVE_PATH,
    compositionRelativePath: VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
  };
}
