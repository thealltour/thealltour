import { existsSync, readFileSync } from "node:fs";

import { VideoClipError, VideoShotError } from "@/lib/marketing/assets/errors";
import { sha256Buffer } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { AI_VIDEO_ASPECT_RATIO, AI_VIDEO_SHOT_LIST_CONTRACT, type AiVideoShot, type AiVideoShotList } from "@/lib/marketing/assets/video/contracts";
import { parseAiVideoShotList } from "@/lib/marketing/assets/video/map";
import { AI_VIDEO_SHOT_LIST_RELATIVE_PATH } from "@/lib/marketing/assets/video/paths";
import { isPortraitNearNineSixteen } from "@/lib/marketing/assets/video/intake/aspect";
import {
  VIDEO_CLIP_INTAKE_CONTRACT,
  type VideoClipIntake,
  type VideoClipIntakeClip,
} from "@/lib/marketing/assets/video/intake/contracts";
import { listIncomingDropFiles, type IncomingDropFile } from "@/lib/marketing/assets/video/intake/incoming";
import {
  createFfprobeIncomingVideoProbe,
  type IncomingVideoMetadata,
  type IncomingVideoProbe,
} from "@/lib/marketing/assets/video/intake/probe";

export type ClipIntakeIssue = {
  shotId: string | null;
  sourceRelativePath: string | null;
  code: string;
  reason: string;
};

export type VideoClipIntakeInspection = {
  complete: boolean;
  candidateId: string;
  expectedShotIds: string[];
  clips: VideoClipIntakeClip[];
  missing: string[];
  invalid: ClipIntakeIssue[];
  ambiguous: Array<{ shotId: string; sourceRelativePaths: string[] }>;
  unmatched: string[];
};

export function readAiVideoShotListFromPackage(packageRoot: string): AiVideoShotList {
  const absolutePath = resolvePackageArtifactPath({
    packageRoot,
    relativePath: AI_VIDEO_SHOT_LIST_RELATIVE_PATH,
  });
  if (!existsSync(absolutePath)) {
    throw new VideoClipError("shot_list_missing", "reel/shot-list.json is required before clip intake");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(absolutePath, "utf8"));
  } catch {
    throw new VideoClipError("invalid_shot_list", "reel/shot-list.json is not valid JSON");
  }
  if (typeof parsed === "object" && parsed !== null && "contract" in parsed) {
    const contract = (parsed as { contract: unknown }).contract;
    if (contract !== AI_VIDEO_SHOT_LIST_CONTRACT) {
      throw new VideoClipError("unsupported_shot_list", "Shot list contract must be ai-video-shot-list-v1");
    }
  }
  try {
    const shotList = parseAiVideoShotList(parsed);
    if (shotList.aspectRatio !== AI_VIDEO_ASPECT_RATIO) {
      throw new VideoClipError("invalid_shot_list", "Shot list aspectRatio must be 9:16");
    }
    return shotList;
  } catch (error) {
    if (error instanceof VideoClipError) throw error;
    if (error instanceof VideoShotError) {
      throw new VideoClipError("invalid_shot_list", error.message);
    }
    throw error;
  }
}

export async function inspectVideoClipIntake(input: {
  packageRoot: string;
  probe?: IncomingVideoProbe;
}): Promise<VideoClipIntakeInspection> {
  const shotList = readAiVideoShotListFromPackage(input.packageRoot);
  const probe = input.probe ?? createFfprobeIncomingVideoProbe();
  const drops = listIncomingDropFiles(input.packageRoot);
  const expectedShotIds = shotList.shots.map((shot) => shot.shotId);
  const missing: string[] = [];
  const invalid: ClipIntakeIssue[] = [];
  const ambiguous: Array<{ shotId: string; sourceRelativePaths: string[] }> = [];
  const unmatched: string[] = [];
  const clips: VideoClipIntakeClip[] = [];

  const mappedByShot = new Map<string, IncomingDropFile[]>();
  for (const drop of drops) {
    if (drop.reason === "unrelated") {
      unmatched.push(drop.relativePath);
      continue;
    }
    if (drop.reason === "unsupported_extension" || drop.reason === "unsafe_name" || drop.reason === "not_regular_file") {
      if (drop.shotId && expectedShotIds.includes(drop.shotId)) {
        invalid.push({
          shotId: drop.shotId,
          sourceRelativePath: drop.relativePath,
          code: drop.reason,
          reason: issueReason(drop),
        });
      } else {
        unmatched.push(drop.relativePath);
      }
      continue;
    }
    if (drop.reason === "symlink") {
      invalid.push({
        shotId: drop.shotId,
        sourceRelativePath: drop.relativePath,
        code: "symlink",
        reason: "Incoming media must be a regular file, not a symlink",
      });
      continue;
    }
    if (drop.reason !== "mapped" || !drop.shotId) {
      unmatched.push(drop.relativePath);
      continue;
    }
    if (!expectedShotIds.includes(drop.shotId)) {
      unmatched.push(drop.relativePath);
      continue;
    }
    const current = mappedByShot.get(drop.shotId) ?? [];
    current.push(drop);
    mappedByShot.set(drop.shotId, current);
  }

  for (const shot of shotList.shots) {
    if (invalid.some((item) => item.shotId === shot.shotId)) {
      continue;
    }
    const candidates = mappedByShot.get(shot.shotId) ?? [];
    if (candidates.length === 0) {
      missing.push(shot.shotId);
      continue;
    }
    if (candidates.length > 1) {
      ambiguous.push({
        shotId: shot.shotId,
        sourceRelativePaths: candidates.map((item) => item.relativePath),
      });
      continue;
    }
    const drop = candidates[0];
    if (!drop) {
      missing.push(shot.shotId);
      continue;
    }
    try {
      const metadata = await probe.probeIncomingVideo(drop.absolutePath);
      const clip = buildClipRecord({ shot, drop, metadata });
      clips.push(clip);
    } catch (error) {
      invalid.push({
        shotId: shot.shotId,
        sourceRelativePath: drop.relativePath,
        code: error instanceof VideoClipError ? error.code : "invalid_clip_metadata",
        reason: error instanceof Error ? error.message : "Incoming clip probe failed",
      });
    }
  }

  const complete =
    missing.length === 0 &&
    invalid.length === 0 &&
    ambiguous.length === 0 &&
    clips.length === shotList.shots.length;

  return {
    complete,
    candidateId: shotList.candidateId,
    expectedShotIds,
    clips,
    missing,
    invalid,
    ambiguous,
    unmatched,
  };
}

function buildClipRecord(input: {
  shot: AiVideoShot;
  drop: IncomingDropFile;
  metadata: IncomingVideoMetadata;
}): VideoClipIntakeClip {
  if (input.metadata.sourceDurationMs < input.shot.durationMs) {
    throw new VideoClipError(
      "invalid_clip_metadata",
      "Incoming clip is shorter than the target shot duration",
    );
  }
  if (!isPortraitNearNineSixteen(input.metadata.width, input.metadata.height)) {
    throw new VideoClipError(
      "invalid_clip_metadata",
      "Incoming clip must be portrait and within 3% of 9:16",
    );
  }

  const bytes = readFileSync(input.drop.absolutePath);
  return {
    shotId: input.shot.shotId,
    ordinal: input.shot.ordinal,
    sourceRelativePath: input.drop.relativePath,
    sourceSha256: sha256Buffer(bytes),
    sourceByteSize: bytes.byteLength,
    codecName: input.metadata.codecName,
    width: input.metadata.width,
    height: input.metadata.height,
    sourceDurationMs: input.metadata.sourceDurationMs,
    targetStartMs: input.shot.startMs,
    targetEndMs: input.shot.endMs,
    targetDurationMs: input.shot.durationMs,
    trimRequired: input.metadata.sourceDurationMs > input.shot.durationMs,
    frameRate: input.metadata.frameRate,
    hasAudio: input.metadata.hasAudio,
  };
}

export function buildCompleteClipIntake(inspection: VideoClipIntakeInspection): VideoClipIntake {
  if (!inspection.complete) {
    throw new VideoClipError("invalid_clip_metadata", "Clip intake is incomplete");
  }
  return {
    contract: VIDEO_CLIP_INTAKE_CONTRACT,
    candidateId: inspection.candidateId,
    shotListRelativePath: AI_VIDEO_SHOT_LIST_RELATIVE_PATH,
    aspectRatio: AI_VIDEO_ASPECT_RATIO,
    complete: true,
    clips: inspection.clips,
  };
}

function issueReason(drop: IncomingDropFile): string {
  if (drop.reason === "unsupported_extension") return "Incoming clip extension is not supported";
  if (drop.reason === "unsafe_name") return "Incoming clip file name is not a safe path segment";
  if (drop.reason === "not_regular_file") return "Incoming clip must be a regular file";
  return drop.reason;
}
