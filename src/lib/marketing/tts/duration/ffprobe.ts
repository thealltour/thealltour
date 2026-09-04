import { existsSync } from "node:fs";
import { isAbsolute } from "node:path";

import {
  DEFAULT_FFPROBE_BINARY,
  DEFAULT_FFPROBE_TIMEOUT_MS,
  FfprobeProcessError,
  runFfprobeJson,
  type FfprobeExecFile,
} from "@/lib/marketing/assets/ffprobe/exec";
import { TtsError } from "@/lib/marketing/tts/errors";
import {
  TTS_AUTHORITATIVE_CLOCK,
  parseFfprobeDurationJson,
  type AudioDurationProbe,
  type PersistedWavDuration,
} from "@/lib/marketing/tts/duration/probe";

export type { FfprobeExecFile };

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
  const execFile = options.execFile;

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
        const stdout = await runFfprobeJson({
          args,
          binary,
          timeoutMs,
          execFile,
        });
        return {
          durationMs: parseFfprobeDurationJson(stdout),
          source: TTS_AUTHORITATIVE_CLOCK,
          absolutePath,
        };
      } catch (error) {
        if (error instanceof TtsError) throw error;
        throw mapFfprobeProcessErrorToTts(error);
      }
    },
  };
}

function mapFfprobeProcessErrorToTts(error: unknown): TtsError {
  if (error instanceof FfprobeProcessError) {
    if (error.kind === "unavailable") {
      return new TtsError("duration_probe_unavailable", error.message);
    }
    if (error.kind === "timeout") {
      return new TtsError("duration_probe_timeout", error.message);
    }
    return new TtsError("duration_probe_failed", error.message);
  }
  return new TtsError("duration_probe_failed", "ffprobe exited unsuccessfully");
}
