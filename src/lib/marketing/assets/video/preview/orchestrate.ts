import { existsSync, statSync } from "node:fs";

import { MarketingAssetConflictError, VideoPreviewError } from "@/lib/marketing/assets/errors";
import { sha256FileSync } from "@/lib/marketing/assets/hashing";
import {
  DEFAULT_FFMPEG_BINARY,
  DEFAULT_FFMPEG_TIMEOUT_MS,
  FfmpegProcessError,
  runFfmpeg,
  type FfmpegExecFile,
} from "@/lib/marketing/assets/ffmpeg/exec";
import { buildPreviewFfmpegArgs } from "@/lib/marketing/assets/video/preview/graph";
import {
  VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
  VIDEO_PREVIEW_RELATIVE_PATH,
} from "@/lib/marketing/assets/video/preview/contracts";
import {
  assertPreviewOutputMetadata,
  createFfprobePreviewOutputProbe,
  type PreviewOutputProbe,
} from "@/lib/marketing/assets/video/preview/outputProbe";
import {
  compositionIdentityFromPlan,
  inspectVideoPreviewReadiness,
  publicPreviewPlan,
  type VideoPreviewPlan,
} from "@/lib/marketing/assets/video/preview/readiness";
import {
  cleanupPreviewTemp,
  compositionAbsolutePath,
  compositionPlanIdentity,
  createPreviewTempPath,
  inspectExistingPreviewSnapshot,
  persistPreviewComposition,
  persistPreviewMp4,
  previewAbsolutePath,
} from "@/lib/marketing/assets/video/preview/persist";

export type FfmpegRunner = {
  run(args: readonly string[]): Promise<void>;
};

export type ComposeVideoPreviewResult = {
  ready: boolean;
  reason: string | null;
  complete: boolean;
  persisted: boolean;
  reused: boolean;
  ffmpegInvoked: boolean;
  status: "not_ready" | "inspected" | "created" | "reused";
  relativePreviewPath: typeof VIDEO_PREVIEW_RELATIVE_PATH;
  relativeCompositionPath: typeof VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH;
  previewSha256: string | null;
  plan: Record<string, unknown> | null;
};

export function createFfmpegRunner(options: {
  binary?: string;
  timeoutMs?: number;
  execFile?: FfmpegExecFile;
} = {}): FfmpegRunner {
  const binary = options.binary?.trim() || DEFAULT_FFMPEG_BINARY;
  const timeoutMs = options.timeoutMs ?? DEFAULT_FFMPEG_TIMEOUT_MS;
  return {
    async run(args: readonly string[]): Promise<void> {
      try {
        await runFfmpeg({ args, binary, timeoutMs, execFile: options.execFile });
      } catch (error) {
        if (error instanceof FfmpegProcessError) {
          if (error.kind === "unavailable") {
            throw new VideoPreviewError("ffmpeg_unavailable", error.message);
          }
          if (error.kind === "timeout") {
            throw new VideoPreviewError("ffmpeg_timeout", error.message);
          }
          throw new VideoPreviewError("ffmpeg_failed", error.message);
        }
        throw new VideoPreviewError("ffmpeg_failed", "ffmpeg exited unsuccessfully");
      }
    },
  };
}

export async function composeVideoPreviewFromPackage(input: {
  packageRoot: string;
  persist: boolean;
  ffmpeg?: FfmpegRunner;
  outputProbe?: PreviewOutputProbe;
  createdAt?: string;
}): Promise<ComposeVideoPreviewResult> {
  const readiness = inspectVideoPreviewReadiness(input.packageRoot);
  if (!readiness.ready) {
    return {
      ready: false,
      reason: readiness.code,
      complete: false,
      persisted: false,
      reused: false,
      ffmpegInvoked: false,
      status: "not_ready",
      relativePreviewPath: VIDEO_PREVIEW_RELATIVE_PATH,
      relativeCompositionPath: VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
      previewSha256: null,
      plan: null,
    };
  }

  const plan = readiness.plan;
  const publicPlan = publicPreviewPlan(plan);
  if (!input.persist) {
    return {
      ready: true,
      reason: null,
      complete: true,
      persisted: false,
      reused: false,
      ffmpegInvoked: false,
      status: "inspected",
      relativePreviewPath: VIDEO_PREVIEW_RELATIVE_PATH,
      relativeCompositionPath: VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
      previewSha256: null,
      plan: publicPlan,
    };
  }

  const existing = inspectExistingPreviewSnapshot(input.packageRoot);
  if (existing.composition && existing.previewSha256) {
    const incomingIdentity = compositionIdentityFromPlan(plan, {
      sha256: existing.previewSha256,
      byteSize: existing.previewByteSize ?? 0,
    });
    if (compositionPlanIdentity(existing.composition) !== compositionPlanIdentity(incomingIdentity)) {
      throw new MarketingAssetConflictError({
        relativePath: VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
        existingSha256: compositionPlanIdentity(existing.composition),
        incomingSha256: compositionPlanIdentity(incomingIdentity),
      });
    }
    return {
      ready: true,
      reason: null,
      complete: true,
      persisted: true,
      reused: true,
      ffmpegInvoked: false,
      status: "reused",
      relativePreviewPath: VIDEO_PREVIEW_RELATIVE_PATH,
      relativeCompositionPath: VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
      previewSha256: existing.previewSha256,
      plan: publicPlan,
    };
  }

  const createdAt = input.createdAt ?? "1970-01-01T00:00:00.000Z";
  const ffmpeg = input.ffmpeg ?? createFfmpegRunner();
  const outputProbe = input.outputProbe ?? createFfprobePreviewOutputProbe();
  const tempAbsolutePath = createPreviewTempPath(input.packageRoot);

  try {
    const graph = buildPreviewFfmpegArgs({
      shots: plan.filterShots,
      narration: plan.filterNarration,
      subtitlesAbsolutePath: plan.subtitlesAbsolutePath,
      outputAbsolutePath: tempAbsolutePath,
      totalDurationMs: plan.totalDurationMs,
    });
    await ffmpeg.run(graph.args);
    if (!existsSync(tempAbsolutePath) || statSync(tempAbsolutePath).size <= 0) {
      throw new VideoPreviewError("preview_qa_failed", "FFmpeg did not produce a non-empty preview file");
    }
    const metadata = await outputProbe.probePreview(tempAbsolutePath);
    assertPreviewOutputMetadata({ metadata, totalDurationMs: plan.totalDurationMs });
    const previewSha256 = sha256FileSync(tempAbsolutePath);
    const previewByteSize = statSync(tempAbsolutePath).size;
    persistPreviewMp4({
      packageRoot: input.packageRoot,
      sourceAbsolutePath: tempAbsolutePath,
      sha256: previewSha256,
      byteSize: previewByteSize,
      createdAt,
    });
    persistPreviewComposition({
      packageRoot: input.packageRoot,
      composition: compositionIdentityFromPlan(plan, { sha256: previewSha256, byteSize: previewByteSize }),
      createdAt,
    });
    return {
      ready: true,
      reason: null,
      complete: true,
      persisted: true,
      reused: false,
      ffmpegInvoked: true,
      status: "created",
      relativePreviewPath: VIDEO_PREVIEW_RELATIVE_PATH,
      relativeCompositionPath: VIDEO_PREVIEW_COMPOSITION_RELATIVE_PATH,
      previewSha256,
      plan: publicPlan,
    };
  } catch (error) {
    cleanupPreviewTemp(tempAbsolutePath);
    throw error;
  }
}

export { compositionAbsolutePath, previewAbsolutePath };
export type { VideoPreviewPlan };
