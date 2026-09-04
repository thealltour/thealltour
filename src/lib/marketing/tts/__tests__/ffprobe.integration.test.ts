import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { createFfprobeDurationProbe } from "@/lib/marketing/tts/duration/ffprobe";
import { TTS_AUTHORITATIVE_CLOCK } from "@/lib/marketing/tts/duration/probe";

const enabled = process.env.A6_FFPROBE_INTEGRATION === "1";
const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length > 0) {
    const dir = tempDirs.pop();
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
});

describe.skipIf(!enabled)("ffprobe integration (A6_FFPROBE_INTEGRATION=1)", () => {
  it("measures a persisted WAV from disk", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ffprobe-it-"));
    tempDirs.push(dir);
    const wavPath = join(dir, "silence.wav");
    const samples = 24000;
    const dataSize = samples * 2;
    const buf = Buffer.alloc(44 + dataSize);
    buf.write("RIFF", 0);
    buf.writeUInt32LE(36 + dataSize, 4);
    buf.write("WAVE", 8);
    buf.write("fmt ", 12);
    buf.writeUInt32LE(16, 16);
    buf.writeUInt16LE(1, 20);
    buf.writeUInt16LE(1, 22);
    buf.writeUInt32LE(24000, 24);
    buf.writeUInt32LE(48000, 28);
    buf.writeUInt16LE(2, 32);
    buf.writeUInt16LE(16, 34);
    buf.write("data", 36);
    buf.writeUInt32LE(dataSize, 40);
    writeFileSync(wavPath, buf);

    const measured = await createFfprobeDurationProbe().probePersistedWav(wavPath);
    expect(measured.source).toBe(TTS_AUTHORITATIVE_CLOCK);
    expect(measured.durationMs).toBe(1000);
    expect(measured.absolutePath).toBe(wavPath);
  });
});
