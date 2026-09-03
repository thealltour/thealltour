import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { randomBytes } from "node:crypto";

import { jsonContainsForbiddenBotLeak } from "@/lib/marketing/bot/sanitize";
import { VideoPreviewError } from "@/lib/marketing/assets/errors";
import { sha256Buffer, sha256FileSync, stableJsonBytes } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import { writePackageArtifact, writePackageArtifactFromFile } from "@/lib/marketing/assets/writeArtifact";
import {
  VIDEO_PREVIEW_COMPOSITION_MEDIA_TYPE,
  VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
  VIDEO_PREVIEW_MEDIA_TYPE,
  VIDEO_PREVIEW_RELATIVE_PATH,
  videoPreviewCompositionSchema,
  type VideoPreviewComposition,
} from "@/lib/marketing/assets/video/preview/contracts";

export function compositionAbsolutePath(packageRoot: string): string {
  return resolvePackageArtifactPath({
    packageRoot,
    relativePath: VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
  });
}

export function previewAbsolutePath(packageRoot: string): string {
  return resolvePackageArtifactPath({
    packageRoot,
    relativePath: VIDEO_PREVIEW_RELATIVE_PATH,
  });
}

export function createPreviewTempPath(packageRoot: string): string {
  const dest = previewAbsolutePath(packageRoot);
  mkdirSync(dirname(dest), { recursive: true });
  return join(dirname(dest), `.preview.${process.pid}.${randomBytes(4).toString("hex")}.tmp.mp4`);
}

export function cleanupPreviewTemp(tempAbsolutePath: string): void {
  if (!existsSync(tempAbsolutePath)) return;
  try {
    unlinkSync(tempAbsolutePath);
  } catch {
    // ignore leftover cleanup
  }
}

export function inspectExistingPreviewSnapshot(packageRoot: string): {
  previewExists: boolean;
  compositionExists: boolean;
  composition: VideoPreviewComposition | null;
  previewSha256: string | null;
  previewByteSize: number | null;
} {
  const previewPath = previewAbsolutePath(packageRoot);
  const compositionPath = compositionAbsolutePath(packageRoot);
  const previewExists = existsSync(previewPath);
  const compositionExists = existsSync(compositionPath);
  if (previewExists !== compositionExists) {
    throw new VideoPreviewError("preview_orphan", "Preview MP4 and composition.json must exist together");
  }
  if (!previewExists || !compositionExists) {
    return {
      previewExists: false,
      compositionExists: false,
      composition: null,
      previewSha256: null,
      previewByteSize: null,
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(compositionPath, "utf8"));
  } catch {
    throw new VideoPreviewError("preview_orphan", "Existing composition.json is not valid JSON");
  }
  const composition = videoPreviewCompositionSchema.safeParse(parsed);
  if (!composition.success) {
    throw new VideoPreviewError("preview_orphan", "Existing composition.json is not video-preview-composition-v1");
  }
  const previewSha256 = sha256FileSync(previewPath);
  const previewByteSize = statSync(previewPath).size;
  if (previewSha256 !== composition.data.previewSha256 || previewByteSize !== composition.data.previewByteSize) {
    throw new VideoPreviewError("preview_orphan", "Existing preview.mp4 hash does not match composition.json");
  }
  return {
    previewExists: true,
    compositionExists: true,
    composition: composition.data,
    previewSha256,
    previewByteSize,
  };
}

export function compositionPlanIdentity(composition: VideoPreviewComposition): string {
  const { previewSha256: _previewSha256, previewByteSize: _previewByteSize, ...plan } = composition;
  return sha256Buffer(stableJsonBytes(plan));
}

export function persistPreviewComposition(input: {
  packageRoot: string;
  composition: VideoPreviewComposition;
  createdAt: string;
}): { status: "created" | "reused"; sha256: string } {
  const parsed = videoPreviewCompositionSchema.safeParse(input.composition);
  if (!parsed.success) {
    throw new VideoPreviewError("preview_qa_failed", "video-preview-composition-v1 is malformed");
  }
  if (jsonContainsForbiddenBotLeak(parsed.data)) {
    throw new VideoPreviewError("preview_qa_failed", "Preview composition contains a forbidden field");
  }
  const written = writePackageArtifact({
    packageRoot: input.packageRoot,
    createdAt: input.createdAt,
    planned: {
      relativePath: VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
      content: stableJsonBytes(parsed.data),
      kind: "context",
      origin: "video_preview_composition",
      mediaType: VIDEO_PREVIEW_COMPOSITION_MEDIA_TYPE,
    },
  });
  return { status: written.status, sha256: written.artifact.sha256 };
}

export function persistPreviewMp4(input: {
  packageRoot: string;
  sourceAbsolutePath: string;
  sha256: string;
  byteSize: number;
  createdAt: string;
}): { status: "created" | "reused" } {
  if (existsSync(input.sourceAbsolutePath) && statSync(input.sourceAbsolutePath).size <= 0) {
    throw new VideoPreviewError("preview_qa_failed", "Rendered preview temp file is empty");
  }
  const written = writePackageArtifactFromFile({
    packageRoot: input.packageRoot,
    createdAt: input.createdAt,
    sourceAbsolutePath: input.sourceAbsolutePath,
    planned: {
      relativePath: VIDEO_PREVIEW_RELATIVE_PATH,
      sha256: input.sha256,
      byteSize: input.byteSize,
      kind: "reel_video",
      origin: "video_preview_composition",
      mediaType: VIDEO_PREVIEW_MEDIA_TYPE,
    },
  });
  return { status: written.status };
}
