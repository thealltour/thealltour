import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

import {
  DEFAULT_FFPROBE_BINARY,
  DEFAULT_FFPROBE_TIMEOUT_MS,
  FfprobeProcessError,
  runFfprobeJson,
  type FfprobeExecFile,
} from "@/lib/marketing/assets/ffprobe/exec";
import { VideoClipError } from "@/lib/marketing/assets/errors";
import { durationSecondsToMs } from "@/lib/marketing/tts/duration/probe";
import { TtsError } from "@/lib/marketing/tts/errors";

export type IncomingVideoMetadata = {
  sourceDurationMs: number;
  codecName: string;
  width: number;
  height: number;
  frameRate: string | null;
  hasAudio: boolean;
};

export type IncomingVideoProbe = {
  probeIncomingVideo(absolutePath: string): Promise<IncomingVideoMetadata>;
};

export type FfprobeIncomingVideoProbeOptions = {
  binary?: string;
  timeoutMs?: number;
  execFile?: FfprobeExecFile;
};

export const FFPROBE_INCOMING_VIDEO_ARGS_PREFIX = [
  "-v",
  "error",
  "-show_entries",
  "format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate",
  "-of",
  "json",
] as const;

export function parseFfprobeVideoJson(stdout: string): IncomingVideoMetadata {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stdout);
  } catch {
    throw new VideoClipError("invalid_clip_metadata", "ffprobe output is not JSON");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new VideoClipError("invalid_clip_metadata", "ffprobe JSON is malformed");
  }

  const format = (parsed as { format?: unknown }).format;
  if (typeof format !== "object" || format === null) {
    throw new VideoClipError("invalid_clip_metadata", "ffprobe JSON is missing format.duration");
  }
  const rawDuration = (format as { duration?: unknown }).duration;
  if (rawDuration == null || rawDuration === "") {
    throw new VideoClipError("invalid_clip_metadata", "ffprobe JSON is missing format.duration");
  }
  const seconds = typeof rawDuration === "number" ? rawDuration : Number(rawDuration);
  let sourceDurationMs: number;
  try {
    sourceDurationMs = durationSecondsToMs(seconds);
  } catch (error) {
    if (error instanceof TtsError) {
      throw new VideoClipError("invalid_clip_metadata", "Incoming clip duration is invalid");
    }
    throw error;
  }

  const streams = (parsed as { streams?: unknown }).streams;
  if (!Array.isArray(streams)) {
    throw new VideoClipError("invalid_clip_metadata", "Incoming clip has no streams");
  }

  const videoStreams = streams.filter((stream) => isRecord(stream) && stream.codec_type === "video");
  if (videoStreams.length === 0) {
    throw new VideoClipError("invalid_clip_metadata", "Incoming clip has no video stream");
  }
  if (videoStreams.length > 1) {
    throw new VideoClipError("invalid_clip_metadata", "Incoming clip must contain exactly one video stream");
  }

  const video = videoStreams[0];
  if (!isRecord(video)) {
    throw new VideoClipError("invalid_clip_metadata", "Incoming clip video stream is malformed");
  }
  const codecName = typeof video.codec_name === "string" ? video.codec_name.trim() : "";
  if (!codecName) {
    throw new VideoClipError("invalid_clip_metadata", "Incoming clip is missing a video codec name");
  }
  const width = parsePositiveInt(video.width);
  const height = parsePositiveInt(video.height);
  if (width == null || height == null) {
    throw new VideoClipError("invalid_clip_metadata", "Incoming clip width and height must be positive integers");
  }

  const hasAudio = streams.some((stream) => isRecord(stream) && stream.codec_type === "audio");
  return {
    sourceDurationMs,
    codecName,
    width,
    height,
    frameRate: parseFrameRate(video.avg_frame_rate),
    hasAudio,
  };
}

export function createFfprobeIncomingVideoProbe(
  options: FfprobeIncomingVideoProbeOptions = {},
): IncomingVideoProbe {
  const binary = options.binary?.trim() || DEFAULT_FFPROBE_BINARY;
  const timeoutMs = options.timeoutMs ?? DEFAULT_FFPROBE_TIMEOUT_MS;
  const execFile = options.execFile;

  return {
    async probeIncomingVideo(absolutePath: string): Promise<IncomingVideoMetadata> {
      if (!isAbsolute(absolutePath)) {
        throw new VideoClipError("incoming_rejected", "ffprobe must run against an absolute incoming clip path");
      }
      if (!existsSync(absolutePath)) {
        throw new VideoClipError("incoming_rejected", "Incoming clip does not exist on disk");
      }
      try {
        const stdout = await runFfprobeJson({
          args: [...FFPROBE_INCOMING_VIDEO_ARGS_PREFIX, absolutePath],
          binary,
          timeoutMs,
          execFile,
        });
        return parseFfprobeVideoJson(stdout);
      } catch (error) {
        if (error instanceof VideoClipError) throw error;
        if (error instanceof FfprobeProcessError) {
          if (error.kind === "unavailable") {
            throw new VideoClipError("clip_probe_unavailable", error.message);
          }
          if (error.kind === "timeout") {
            throw new VideoClipError("clip_probe_timeout", error.message);
          }
          throw new VideoClipError("clip_probe_failed", error.message);
        }
        throw new VideoClipError("clip_probe_failed", "ffprobe exited unsuccessfully");
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

function parseFrameRate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "0/0" || trimmed === "N/A") return null;
  return trimmed.slice(0, 32);
}
