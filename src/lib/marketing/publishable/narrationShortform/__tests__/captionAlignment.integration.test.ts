// @vitest-environment node
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AudioMasterTimeline } from "@/lib/marketing/tts/timeline/contracts";
import { alignmentTextFingerprint, alignmentUnits } from "../alignmentText";
import { alignedCueTiming, alignmentConfig, evaluateAlignedSentence, executeMiniAlign, runnerResponseSchema } from "../captionAlignment";

/**
 * Opt-in: runs the pinned runner on the mini-PC over SSH with real TTS fixtures whose phrase boundaries are known to the sample.
 * NARRATION_ALIGN_INTEGRATION=1 NARRATION_ALIGN_FIXTURE_DIR=<dir with manifest.json + wavs> [NARRATION_ALIGN_PYTHON/RUNNER=...] [NARRATION_ALIGN_CAPTURE=<json path>]
 */
const enabled = process.env.NARRATION_ALIGN_INTEGRATION === "1";
type Manifest = Record<string, { sampleRate: number; phrases: string[]; text: string; phraseSamples: [number, number][] }>;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
function wavDurationMs(buffer: Buffer) {
  let offset = 12; let rate = 0; let blockAlign = 0;
  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4); const size = buffer.readUInt32LE(offset + 4);
    if (id === "fmt ") { rate = buffer.readUInt32LE(offset + 12); blockAlign = buffer.readUInt16LE(offset + 20); }
    if (id === "data") return Math.round(size / blockAlign / rate * 1000);
    offset += 8 + size + (size % 2);
  }
  throw new Error("no data chunk");
}

describe.skipIf(!enabled)("caption alignment on the mini-PC runner (NARRATION_ALIGN_INTEGRATION=1)", () => {
  it("verifies matching Korean/number/English speech, flags mismatches, and places cue onsets near true phrase starts", async () => {
    const dir = process.env.NARRATION_ALIGN_FIXTURE_DIR!; const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as Manifest;
    const cases = [
      ...Object.keys(manifest).flatMap(k => [{ name: k, wav: `${k}.wav`, text: manifest[k]!.text, truth: k, expect: "verified" }, { name: `${k}-natural`, wav: `${k}-natural.wav`, text: manifest[k]!.text, truth: null, expect: "verified" }]),
      { name: "missing", wav: "missing.wav", text: manifest.ko!.text, truth: null, expect: "not_verified" },
      { name: "wrong", wav: "ko.wav", text: manifest.numbers!.text, truth: null, expect: "not_verified" },
      { name: "silence", wav: "silence.wav", text: manifest.ko!.text, truth: null, expect: "failed" },
    ];
    const inputs = cases.map(c => { const audio = readFileSync(join(dir, c.wav)); const units = alignmentUnits(c.text);
      return { audio, input: { sentenceId: randomUUID(), audioRelativePath: c.wav, audioSha256: sha(audio), durationMs: wavDurationMs(audio), text: c.text, textFingerprint: alignmentTextFingerprint(c.text, units), units } }; });
    const request = { contract: "narration-caption-align-input-v1", jobId: randomUUID(), inputFingerprint: "0".repeat(64), config: alignmentConfig(),
      sentences: inputs.map(({ audio, input }) => ({ sentenceId: input.sentenceId, audioSha256: input.audioSha256, audioBase64: audio.toString("base64"), units: input.units })) };
    const started = Date.now(); const response = runnerResponseSchema.parse(JSON.parse(await executeMiniAlign(JSON.stringify(request)))); const wallMs = Date.now() - started;
    const rows = cases.map((c, i) => {
      const { input } = inputs[i]!; const raw = response.sentences[i]!; const result = evaluateAlignedSentence(input, raw);
      let cueOnsetErrorsMs: number[] | null = null;
      if (c.truth) {
        const m = manifest[c.truth]!; let cp = 0; const ranges: [number, number][] = [];
        for (const phrase of m.phrases) { const end = cp + [...phrase].length; ranges.push([cp, end]); cp = end + 1; }
        const segment = { segmentId: input.sentenceId, startMs: 0, endMs: input.durationMs, text: c.text } as AudioMasterTimeline["segments"][number];
        const timing = alignedCueTiming(segment, ranges, result);
        cueOnsetErrorsMs = timing ? timing.times.slice(1).map((t, k) => t.startMs - Math.round(m.phraseSamples[k + 1]![0] / m.sampleRate * 1000)) : null;
      }
      return { name: c.name, expect: c.expect, status: result.status, reasons: result.reasons, unitCer: result.measures.unitCer, elapsedMs: raw.elapsedMs, cueOnsetErrorsMs, text: c.text, durationMs: input.durationMs,
        audioSha256: input.audioSha256, units: input.units, raw, phrases: c.truth ? manifest[c.truth]!.phrases : null,
        truthOnsetsMs: c.truth ? manifest[c.truth]!.phraseSamples.map(([a]) => Math.round(a / manifest[c.truth!]!.sampleRate * 1000)) : null };
    });
    const summary = { runner: { runnerSha256: response.runnerSha256, modelId: response.modelId, torch: response.torchVersion, transformers: response.transformersVersion, numpy: response.numpyVersion,
      threads: response.threads, modelLoadMs: response.modelLoadMs, elapsedMs: response.elapsedMs, wallMs }, rows };
    console.log(JSON.stringify({ ...summary, rows: rows.map(({ name, status, reasons, unitCer, elapsedMs, cueOnsetErrorsMs, durationMs }) => ({ name, status, reasons, unitCer, elapsedMs, durationMs, cueOnsetErrorsMs })) }, null, 1));
    if (process.env.NARRATION_ALIGN_CAPTURE) writeFileSync(process.env.NARRATION_ALIGN_CAPTURE, JSON.stringify(summary, null, 1));
    for (const row of rows) {
      if (row.expect === "verified") expect(row.status, row.name).toBe("verified");
      else if (row.expect === "failed") expect(row.status, row.name).toBe("failed");
      else expect(row.status, row.name).not.toBe("verified");
      if (row.phrases) { expect(row.cueOnsetErrorsMs, row.name).not.toBeNull(); for (const error of row.cueOnsetErrorsMs!) expect(Math.abs(error), row.name).toBeLessThanOrEqual(80); }
    }
  }, 600_000);
});
