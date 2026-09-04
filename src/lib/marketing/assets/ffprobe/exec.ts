import { execFile as execFileCallback } from "node:child_process";
import { promisify } from "node:util";

export const DEFAULT_FFPROBE_BINARY = "ffprobe";
export const DEFAULT_FFPROBE_TIMEOUT_MS = 10_000;

export type FfprobeExecFile = (
  file: string,
  args: readonly string[],
  options: { timeout: number; encoding: "utf8"; maxBuffer: number },
) => Promise<{ stdout: string; stderr: string }>;

export const defaultFfprobeExecFile = promisify(execFileCallback) as unknown as FfprobeExecFile;

export type FfprobeProcessFailureKind = "unavailable" | "timeout" | "failed";

export class FfprobeProcessError extends Error {
  readonly name = "FfprobeProcessError";
  readonly kind: FfprobeProcessFailureKind;

  constructor(kind: FfprobeProcessFailureKind, message: string) {
    super(message);
    this.kind = kind;
  }
}

export function classifyFfprobeExecError(error: unknown, timeoutMs: number): FfprobeProcessError {
  const err = error as {
    code?: string | number;
    killed?: boolean;
    signal?: string | null;
    message?: string;
  };
  if (err.code === "ENOENT") {
    return new FfprobeProcessError("unavailable", "ffprobe executable was not found");
  }
  if (err.killed === true || err.code === "ERR_TIMEOUT" || err.signal === "SIGTERM") {
    return new FfprobeProcessError("timeout", `ffprobe timed out after ${timeoutMs}ms`);
  }
  return new FfprobeProcessError("failed", "ffprobe exited unsuccessfully");
}

export async function runFfprobeJson(input: {
  args: readonly string[];
  binary?: string;
  timeoutMs?: number;
  execFile?: FfprobeExecFile;
}): Promise<string> {
  const binary = input.binary?.trim() || DEFAULT_FFPROBE_BINARY;
  const timeoutMs = input.timeoutMs ?? DEFAULT_FFPROBE_TIMEOUT_MS;
  const execFile = input.execFile ?? defaultFfprobeExecFile;
  try {
    const { stdout } = await execFile(binary, input.args, {
      timeout: timeoutMs,
      encoding: "utf8",
      maxBuffer: 256 * 1024,
    });
    return stdout;
  } catch (error) {
    if (error instanceof FfprobeProcessError) throw error;
    throw classifyFfprobeExecError(error, timeoutMs);
  }
}
