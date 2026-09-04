import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

import {
  DEFAULT_FFPROBE_BINARY,
  DEFAULT_FFPROBE_TIMEOUT_MS,
  FfprobeProcessError,
  runFfprobeJson,
  type FfprobeExecFile,
} from "@/lib/marketing/assets/ffprobe/exec";
import { VideoPreviewError } from "@/lib/marketing/assets/errors";
import {
  VIDEO_PREVIEW_AUDIO_CODEC,
  VIDEO_PREVIEW_DURATION_QA_TOLERANCE_MS,
  VIDEO_PREVIEW_HEIGHT,
  VIDEO_PREVIEW_SUBTITLE_CODEC,
  VIDEO_PREVIEW_VIDEO_CODEC_NAME,
  VIDEO_PREVIEW_WIDTH,
  isCompatiblePreviewFps,
} from "@/lib/marketing/assets/video/preview/profile";
import { durationSecondsToMs } from "@/lib/marketing/tts/duration/probe";
import { TtsError } from "@/lib/marketing/tts/errors";

export type PreviewOutputMetadata = {
  durationMs: number;
  videoCodec: string;
  width: number;
  height: number;
  frameRate: string | null;
  hasAudio: boolean;
  audioCodec: string | null;
  hasSubtitle: boolean;
  subtitleCodec: string | null;
};

export type PreviewOutputProbe = {
  probePreview(absolutePath: string): Promise<PreviewOutputMetadata>;
};

export const FFPROBE_PREVIEW_OUTPUT_ARGS_PREFIX = [
  "-v",
  "error",
  "-show_entries",
  "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate",
  "-of",
  "json",
] as const;

export function parseFfprobePreviewJson(stdout: string): PreviewOutputMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new VideoPreviewError("preview_qa_failed", "Preview ffprobe output is not JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new VideoPreviewError("preview_qa_failed", "Preview ffprobe JSON is malformed");
  }

  const format = (parsed as { format?: unknown }).format;
  if (typeof format !== "object" || format === null) {
    throw new VideoPreviewError("preview_qa_failed", "Preview ffprobe JSON is missing format.duration");
  }
  const rawDuration = (format as { duration?: unknown }).duration;
  if (rawDuration == null || rawDuration === "") {
    throw new VideoPreviewError("preview_qa_failed", "Preview ffprobe JSON is missing format.duration");
  }
  const seconds = typeof rawDuration === "number" ? rawDuration : Number(rawDuration);
  let durationMs: number;
  try {
    durationMs = durationSecondsToMs(seconds);
  } catch (error) {
    if (error instanceof TtsError) {
      throw new VideoPreviewError("preview_qa_failed", "Preview duration is invalid");
    }
    throw error;
  }

  const streams = (parsed as { streams?: unknown }).streams;
  if (!Array.isArray(streams)) {
    throw new VideoPreviewError("preview_qa_failed", "Preview has no streams");
  }

  const videoStreams = streams.filter((stream) => isRecord(stream) && stream.codec_type === "video");
  if (videoStreams.length === 0) {
    throw new VideoPreviewError("preview_qa_failed", "Preview is missing a video stream");
  }
  if (videoStreams.length > 1) {
    throw new VideoPreviewError("preview_qa_failed", "Preview must contain exactly one video stream");
  }
  const video = videoStreams[0];
  if (!isRecord(video)) {
    throw new VideoPreviewError("preview_qa_failed", "Preview video stream is malformed");
  }
  const videoCodec = typeof video.codec_name === "string" ? video.codec_name.trim() : "";
  const width = parsePositiveInt(video.width);
  const height = parsePositiveInt(video.height);
  const frameRate = typeof video.avg_frame_rate === "string" ? video.avg_frame_rate : null;

  const audioStreams = streams.filter((stream) => isRecord(stream) && stream.codec_type === "audio");
  const subtitleStreams = streams.filter((stream) => isRecord(stream) && stream.codec_type === "subtitle");
  const audio = audioStreams[0];
  const subtitle = subtitleStreams[0];

  return {
    durationMs,
    videoCodec,
    width: width ?? 0,
    height: height ?? 0,
    frameRate,
    hasAudio: audioStreams.length > 0,
    audioCodec: isRecord(audio) && typeof audio.codec_name === "string" ? audio.codec_name : null,
    hasSubtitle: subtitleStreams.length > 0,
    subtitleCodec: isRecord(subtitle) && typeof subtitle.codec_name === "string" ? subtitle.codec_name : null,
  };
}

export function assertPreviewOutputMetadata(input: {
  metadata: PreviewOutputMetadata;
  totalDurationMs: number;
}): void {
  const { metadata, totalDurationMs } = input;
  if (metadata.videoCodec !== VIDEO_PREVIEW_VIDEO_CODEC_NAME) {
    throw new VideoPreviewError("preview_qa_failed", "Preview video codec must be h264");
  }
  if (metadata.width !== VIDEO_PREVIEW_WIDTH || metadata.height !== VIDEO_PREVIEW_HEIGHT) {
    throw new VideoPreviewError("preview_qa_failed", "Preview frame size must be 720x1280");
  }
  if (!isCompatiblePreviewFps(metadata.frameRate)) {
    throw new VideoPreviewError("preview_qa_failed", "Preview fps must be 30");
  }
  if (!metadata.hasAudio || metadata.audioCodec !== VIDEO_PREVIEW_AUDIO_CODEC) {
    throw new VideoPreviewError("preview_qa_failed", "Preview is missing canonical AAC narration audio");
  }
  if (!metadata.hasSubtitle || metadata.subtitleCodec !== VIDEO_PREVIEW_SUBTITLE_CODEC) {
    throw new VideoPreviewError("preview_qa_failed", "Preview is missing the soft mov_text subtitle track");
  }
  if (Math.abs(metadata.durationMs - totalDurationMs) > VIDEO_PREVIEW_DURATION_QA_TOLERANCE_MS) {
    throw new VideoPreviewError(
      "preview_qa_failed",
      `Preview duration ${metadata.durationMs}ms is outside the ${VIDEO_PREVIEW_DURATION_QA_TOLERANCE_MS}ms frame QA tolerance of ${totalDurationMs}ms`,
    );
  }
}

export function createFfprobePreviewOutputProbe(options: {
  binary?: string;
  timeoutMs?: number;
  execFile?: FfprobeExecFile;
} = {}): PreviewOutputProbe {
  const binary = options.binary?.trim() || DEFAULT_FFPROBE_BINARY;
  const timeoutMs = options.timeoutMs ?? DEFAULT_FFPROBE_TIMEOUT_MS;
  const execFile = options.execFile;

  return {
    async probePreview(absolutePath: string): Promise<PreviewOutputMetadata> {
      if (!isAbsolute(absolutePath)) {
        throw new VideoPreviewError("preview_qa_failed", "Preview ffprobe must run against an absolute path");
      }
      if (!existsSync(absolutePath)) {
        throw new VideoPreviewError("preview_qa_failed", "Preview file does not exist");
      }
      try {
        const stdout = await runFfprobeJson({
          args: [...FFPROBE_PREVIEW_OUTPUT_ARGS_PREFIX, absolutePath],
          binary,
          timeoutMs,
          execFile,
        });
        return parseFfprobePreviewJson(stdout);
      } catch (error) {
        if (error instanceof VideoPreviewError) throw error;
        if (error instanceof FfprobeProcessError) {
          throw new VideoPreviewError("preview_qa_failed", error.message);
        }
        throw new VideoPreviewError("preview_qa_failed", "Preview ffprobe exited unsuccessfully");
      }
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parsePositiveInt(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) return parsed;
  }
  return null;
}
