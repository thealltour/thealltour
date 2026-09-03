import { execFile as execFileCallback } from "node:child_process";
import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";
import { promisify } from "node:util";

import { TtsError } from "@/lib/marketing/tts/errors";
import {
  DEFAULT_FFPROBE_BINARY,
  DEFAULT_FFPROBE_TIMEOUT_MS,
  TTS_AUTHORITATIVE_CLOCK,
  parseFfprobeDurationJson,
  type AudioDurationProbe,
  type PersistedWavDuration,
} from "@/lib/marketing/tts/duration/probe";

export type FfprobeExecFile = (
  file: string,
  args: readonly string[],
  options: { timeout: number; encoding: "utf8"; maxBuffer: number },
) => Promise<{ stdout: string; stderr: string }>;

const defaultExecFile = promisify(execFileCallback) as unknown as FfprobeExecFile;

export type FfprobeDurationProbeOptions = {
  binary?: string;
  timeoutMs?: number;
  execFile?: FfprobeExecFile;
};

export function createFfprobeDurationProbe(
  options: FfprobeDurationProbeOptions = {},
): AudioDurationProbe {
  const binary = options.binary?.trim() || DEFAULT_FFPROBE_BINARY;
  const timeoutMs = options.timeoutMs ?? DEFAULT_FFPROBE_TIMEOUT_MS;
  const execFile = options.execFile ?? defaultExecFile;

  return {
    async probePersistedWav(absolutePath: string): Promise<PersistedWavDuration> {
      if (!isAbsolute(absolutePath)) {
        throw new TtsError("invalid_request", "ffprobe must run against an absolute persisted WAV path");
      }
      if (!existsSync(absolutePath)) {
        throw new TtsError("invalid_request", "ffprobe target WAV does not exist on disk");
      }

      const args = ["-v", "error", "-show_entries", "format=duration", "-of", "json", absolutePath];
      try {
        const { stdout } = await execFile(binary, args, {
          timeout: timeoutMs,
          encoding: "utf8",
          maxBuffer: 256 * 1024,
        });
        return {
          durationMs: parseFfprobeDurationJson(stdout),
          source: TTS_AUTHORITATIVE_CLOCK,
          absolutePath,
        };
      } catch (error) {
        if (error instanceof TtsError) throw error;
        throw classifyFfprobeExecError(error, timeoutMs);
      }
    },
  };
}

function classifyFfprobeExecError(error: unknown, timeoutMs: number): TtsError {
  const err = error as {
    code?: string | number;
    killed?: boolean;
    signal?: string | null;
    message?: string;
  };
  if (err.code === "ENOENT") {
    return new TtsError("duration_probe_unavailable", "ffprobe executable was not found");
  }
  if (err.killed === true || err.code === "ERR_TIMEOUT" || err.signal === "SIGTERM") {
    return new TtsError("duration_probe_timeout", `ffprobe timed out after ${timeoutMs}ms`);
  }
  return new TtsError("duration_probe_failed", "ffprobe exited unsuccessfully");
}
