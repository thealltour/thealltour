import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TtsError } from "@/lib/marketing/tts/errors";
import { createFfprobeDurationProbe } from "@/lib/marketing/tts/duration/ffprobe";
import {
  TTS_AUTHORITATIVE_CLOCK,
  durationSecondsToMs,
  parseFfprobeDurationJson,
} from "@/lib/marketing/tts/duration/probe";

const tempDirs: string[] = [];

function tempWav(): string {
  const dir = mkdtempSync(join(tmpdir(), "ffprobe-"));
  tempDirs.push(dir);
  const path = join(dir, "persisted.wav");
  writeFileSync(path, "RIFF");
  return path;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe("ffprobe duration parsing", () => {
  it("converts finite positive seconds to integer milliseconds", () => {
    expect(durationSecondsToMs(1.25)).toBe(1250);
    expect(parseFfprobeDurationJson(JSON.stringify({ format: { duration: "1.250" } }))).toBe(1250);
  });

  it("rejects missing, malformed, zero, negative, NaN, and infinite durations", () => {
    expect(() => parseFfprobeDurationJson("not-json")).toThrow(TtsError);
    expect(() => parseFfprobeDurationJson("{}")).toThrow(/missing format.duration/);
    expect(() => parseFfprobeDurationJson(JSON.stringify({ format: {} }))).toThrow(/missing format.duration/);
    expect(() => durationSecondsToMs(0)).toThrow(TtsError);
    expect(() => durationSecondsToMs(-1)).toThrow(TtsError);
    expect(() => durationSecondsToMs(Number.NaN)).toThrow(TtsError);
    expect(() => durationSecondsToMs(Number.POSITIVE_INFINITY)).toThrow(TtsError);
    try {
      durationSecondsToMs(0);
    } catch (error) {
      expect((error as TtsError).code).toBe("invalid_duration");
    }
  });

  it("refuses a relative path so in-memory buffers cannot become the clock", async () => {
    const probe = createFfprobeDurationProbe({
      execFile: async () => {
        throw new Error("should not run");
      },
    });
    await expect(probe.probePersistedWav("reel/audio/segment-0001.wav")).rejects.toMatchObject({
      code: "invalid_request",
    });
  });
});

describe("injected ffprobe process boundary", () => {
  it("classifies a missing executable", async () => {
    const probe = createFfprobeDurationProbe({
      execFile: async () => {
        const error = new Error("spawn ffprobe ENOENT") as Error & { code: string };
        error.code = "ENOENT";
        throw error;
      },
    });
    await expect(probe.probePersistedWav(tempWav())).rejects.toMatchObject({
      code: "duration_probe_unavailable",
    });
  });

  it("classifies a non-zero ffprobe exit", async () => {
    const probe = createFfprobeDurationProbe({
      execFile: async () => {
        const error = new Error("Command failed") as Error & { code: number };
        error.code = 1;
        throw error;
      },
    });
    await expect(probe.probePersistedWav(tempWav())).rejects.toMatchObject({
      code: "duration_probe_failed",
    });
  });

  it("classifies an ffprobe timeout", async () => {
    const probe = createFfprobeDurationProbe({
      timeoutMs: 25,
      execFile: async () => {
        const error = new Error("timeout") as Error & { killed: boolean; code: string };
        error.killed = true;
        error.code = "ERR_TIMEOUT";
        throw error;
      },
    });
    await expect(probe.probePersistedWav(tempWav())).rejects.toMatchObject({
      code: "duration_probe_timeout",
    });
  });

  it("uses argv without a shell and returns persisted_wav_ffprobe", async () => {
    const absolutePath = tempWav();
    const execFile = vi.fn(async (file: string, args: readonly string[]) => {
      expect(file).toBe("ffprobe");
      expect(args).toEqual([
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        absolutePath,
      ]);
      return { stdout: JSON.stringify({ format: { duration: "2.5" } }), stderr: "" };
    });
    const probe = createFfprobeDurationProbe({ execFile });
    const measured = await probe.probePersistedWav(absolutePath);
    expect(measured).toEqual({
      durationMs: 2500,
      source: TTS_AUTHORITATIVE_CLOCK,
      absolutePath,
    });
    expect(execFile).toHaveBeenCalledTimes(1);
  });
});
