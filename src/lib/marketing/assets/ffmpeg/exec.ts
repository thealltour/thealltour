import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

export const DEFAULT_FFMPEG_BINARY = "ffmpeg";
export const DEFAULT_FFMPEG_TIMEOUT_MS = 120_000;

export type FfmpegExecFile = (
  file: string,
  args: readonly string[],
  options: { timeout: number; encoding: "utf8"; maxBuffer: number },
) => Promise<{ stdout: string; stderr: string }>;

export const defaultFfmpegExecFile = promisify(execFileCallback) as unknown as FfmpegExecFile;

export type FfmpegProcessFailureKind = "unavailable" | "timeout" | "failed";

export class FfmpegProcessError extends Error {
  readonly name = "FfmpegProcessError";
  readonly kind: FfmpegProcessFailureKind;

  constructor(kind: FfmpegProcessFailureKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export function classifyFfmpegExecError(error: unknown, timeoutMs: number): FfmpegProcessError {
  const err = error as {
    code?: string | number;
    killed?: boolean;
    signal?: string | null;
    message?: string;
    stderr?: string;
  };
  if (err.code === "ENOENT") {
    return new FfmpegProcessError("unavailable", "ffmpeg executable was not found");
  }
  if (err.killed === true || err.code === "ERR_TIMEOUT" || err.signal === "SIGTERM") {
    return new FfmpegProcessError("timeout", `ffmpeg timed out after ${timeoutMs}ms`);
  }
  const stderr = typeof err.stderr === "string" ? err.stderr.trim() : "";
  const tail = stderr.slice(Math.max(0, stderr.length - 800));
  return new FfmpegProcessError(
    "failed",
    tail ? `ffmpeg exited unsuccessfully: ${tail}` : "ffmpeg exited unsuccessfully",
  );
}

export async function runFfmpeg(input: {
  args: readonly string[];
  binary?: string;
  timeoutMs?: number;
  execFile?: FfmpegExecFile;
}): Promise<void> {
  const binary = input.binary?.trim() || DEFAULT_FFMPEG_BINARY;
  const timeoutMs = input.timeoutMs ?? DEFAULT_FFMPEG_TIMEOUT_MS;
  const execFile = input.execFile ?? defaultFfmpegExecFile;
  try {
    await execFile(binary, input.args, {
      timeout: timeoutMs,
      encoding: "utf8",
      maxBuffer: 1024 * 1024,
    });
  } catch (error) {
    if (error instanceof FfmpegProcessError) throw error;
    throw classifyFfmpegExecError(error, timeoutMs);
  }
}
