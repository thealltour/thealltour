import { existsSync, lstatSync, statSync } from "node:fs";
import { basename } from "node:path";

import { VideoPreviewError } from "@/lib/marketing/assets/errors";
import { sha256FileSync } from "@/lib/marketing/assets/hashing";
import { assertPathInside, resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { AI_VIDEO_INCOMING_DIRECTORY } from "@/lib/marketing/assets/video/intake/contracts";
import type { VideoClipIntakeClip } from "@/lib/marketing/assets/video/intake/contracts";
import type { AudioMasterTimelineSegment } from "@/lib/marketing/tts/timeline/contracts";

function assertRegularFile(absolutePath: string, label: string): void {
  if (!existsSync(absolutePath)) {
    throw new VideoPreviewError("stale_source", `${label} is missing`);
  }
  const stats = lstatSync(absolutePath);
  if (stats.isSymbolicLink()) {
    throw new VideoPreviewError("stale_source", `${label} must be a regular file, not a symlink`);
  }
  if (!stats.isFile()) {
    throw new VideoPreviewError("stale_source", `${label} must be a regular file`);
  }
}

export function revalidateIncomingClip(input: {
  packageRoot: string;
  clip: VideoClipIntakeClip;
}): { absolutePath: string; sha256: string; byteSize: number } {
  if (!input.clip.sourceRelativePath.startsWith(`${AI_VIDEO_INCOMING_DIRECTORY}/`)) {
    throw new VideoPreviewError("stale_source", "Incoming clip path must remain under reel/incoming");
  }
  if (basename(input.clip.sourceRelativePath).includes("..")) {
    throw new VideoPreviewError("stale_source", "Incoming clip path is unsafe");
  }
  const absolutePath = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: input.clip.sourceRelativePath,
  });
  const incomingRoot = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: AI_VIDEO_INCOMING_DIRECTORY,
  });
  assertPathInside(incomingRoot, absolutePath, "incoming clip path");
  assertRegularFile(absolutePath, input.clip.sourceRelativePath);
  const byteSize = statSync(absolutePath).size;
  if (byteSize !== input.clip.sourceByteSize) {
    throw new VideoPreviewError("source_size_mismatch", "Incoming clip byte size does not match clip-intake.json");
  }
  const sha256 = sha256FileSync(absolutePath);
  if (sha256 !== input.clip.sourceSha256) {
    throw new VideoPreviewError("source_hash_mismatch", "Incoming clip SHA256 does not match clip-intake.json");
  }
  return { absolutePath, sha256, byteSize };
}

export function revalidateNarrationWav(input: {
  packageRoot: string;
  segment: AudioMasterTimelineSegment;
}): { absolutePath: string; sha256: string } {
  if (!input.segment.relativeAudioPath.startsWith("reel/audio/")) {
    throw new VideoPreviewError("stale_source", "Narration WAV path must remain under reel/audio");
  }
  const absolutePath = resolvePackageArtifactPath({
    packageRoot: input.packageRoot,
    relativePath: input.segment.relativeAudioPath,
  });
  assertRegularFile(absolutePath, input.segment.relativeAudioPath);
  const sha256 = sha256FileSync(absolutePath);
  if (sha256 !== input.segment.audioSha256) {
    throw new VideoPreviewError("narration_hash_mismatch", "Narration WAV SHA256 does not match timeline.json");
  }
  return { absolutePath, sha256 };
}
