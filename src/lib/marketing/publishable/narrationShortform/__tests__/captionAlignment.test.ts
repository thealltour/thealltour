// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AudioMasterTimeline } from "@/lib/marketing/tts/timeline/contracts";
import { alignmentTextFingerprint, alignmentUnits } from "../alignmentText";
import { alignedCueTiming, evaluateAlignedSentence, type RunnerSentence } from "../captionAlignment";

/** Real runner output on the TTS fixtures (captured by captionAlignment.integration.test.ts); phrase starts are exact sample positions. */
type Row = { name: string; text: string; durationMs: number; audioSha256: string; units: ReturnType<typeof alignmentUnits>; raw: RunnerSentence; phrases: string[] | null; truthOnsetsMs: number[] | null };
const captured = JSON.parse(readFileSync(join(__dirname, "__fixtures__/caption-alignment-runner-output.json"), "utf8")) as { rows: Row[] };
const row = (name: string) => captured.rows.find(r => r.name === name)!;
const input = (r: Row) => ({ sentenceId: r.raw.sentenceId, audioRelativePath: `${r.name}.wav`, audioSha256: r.audioSha256, durationMs: r.durationMs, text: r.text, textFingerprint: alignmentTextFingerprint(r.text, r.units), units: r.units });
const slice = (text: string, u: { cpStart: number; cpEnd: number }) => [...text].slice(u.cpStart, u.cpEnd).join("");

describe("caption alignment text units", () => {
  it("keeps original code-point ranges and offers spoken readings for numbers, dates, times, money and Latin words without rewriting the sentence", () => {
    const text = "Jeju Olle 7코스는 2026년 3월 1일(일)부터 09:00~18:00 운영하며, 입장료는 1,500원입니다!"; const units = alignmentUnits(text);
    expect(units.map(u => slice(text, u))).toEqual(["Jeju", "Olle", "7", "코스는", "2026", "년", "3", "월", "1", "일", "일", "부터", "09:00", "~", "18:00", "운영하며", "입장료는", "1,500", "원입니다"]);
    const by = (s: string) => units.find(u => slice(text, u) === s)!;
    expect(by("2026").readings).toContain("이천이십육"); expect(by("1,500").readings).toContain("천오백"); expect(by("09:00").readings).toEqual(expect.arrayContaining(["아홉시", "구시 정각"]));
    expect(by("Jeju").readings).toEqual(["*"]); for (const u of units.filter(u => u.kind === "number")) expect(u.readings).toContain("*");
    expect(units.filter(u => slice(text, u) === "일")[1]!.readings).toEqual(["일", ""]); // parenthesized weekday may be skipped by TTS
    expect(alignmentUnits("버스는 오전 7시 30분에, 왕복 12,000원").find(u => slice("버스는 오전 7시 30분에, 왕복 12,000원", u) === "7")!.readings[0]).toBe("일곱");
    expect(alignmentUnits("KTX로 30% 할인").map(u => u.readings[0])).toEqual(["케이티엑스", "로", "삼십", "퍼센트", "할인"]);
    for (let i = 1; i < units.length; i++) expect(units[i]!.cpStart).toBeGreaterThanOrEqual(units[i - 1]!.cpEnd);
    expect(alignmentTextFingerprint(text, units)).not.toBe(alignmentTextFingerprint(`${text} `, alignmentUnits(`${text} `)));
  });
});

describe("caption alignment validation on real runner output", () => {
  it("matching Korean, number and Latin-mixed speech verifies; missing speech and wrong text need review; silence fails; nothing claims a confidence", () => {
    for (const name of ["ko", "ko-natural", "mixed", "mixed-natural", "numbers", "numbers-natural"]) {
      const result = evaluateAlignedSentence(input(row(name)), row(name).raw); expect(result.status, name).toBe("verified"); expect(result.measures.unitCer!).toBeLessThanOrEqual(0.08);
      let previous = -1; for (const u of result.units.filter(u => u.startMs !== null)) { expect(u.startMs!).toBeGreaterThanOrEqual(previous); expect(u.endMs!).toBeGreaterThan(u.startMs!); expect(u.endMs!).toBeLessThanOrEqual(row(name).durationMs); previous = u.startMs!; }
      expect(Object.keys(result).some(k => /confidence/i.test(k))).toBe(false);
    }
    expect(evaluateAlignedSentence(input(row("missing")), row("missing").raw)).toMatchObject({ status: "review_required", reasons: expect.arrayContaining(["compressed_speech", "text_audio_mismatch", "low_alignment_likelihood"]) });
    expect(evaluateAlignedSentence(input(row("wrong")), row("wrong").raw)).toMatchObject({ status: "review_required", reasons: expect.arrayContaining(["text_audio_mismatch", "low_alignment_likelihood"]) });
    expect(evaluateAlignedSentence(input(row("silence")), row("silence").raw)).toMatchObject({ status: "failed", reasons: ["no_speech"], units: [] });
  });

  it("malformed or mismatched runner output fails instead of producing times", () => {
    const r = row("ko"); const units = r.raw.units!;
    expect(evaluateAlignedSentence({ ...input(r), audioSha256: "0".repeat(64) }, r.raw).reasons).toEqual(["identity_mismatch"]);
    expect(evaluateAlignedSentence(input(r), { ...r.raw, units: units.slice(1) }).reasons).toEqual(["unit_count_mismatch"]);
    expect(evaluateAlignedSentence(input(r), { ...r.raw, units: [units[1]!, units[0]!, ...units.slice(2)] }).reasons).toEqual(["unit_order_mismatch"]);
    expect(evaluateAlignedSentence(input(r), { ...r.raw, units: units.map((u, i) => i === 3 ? { ...u, spoken: false, startMs: null, endMs: null } : u) }).reasons).toEqual(["unit_missing"]);
    expect(evaluateAlignedSentence(input(r), { ...r.raw, units: units.map((u, i) => i === 3 ? { ...u, endMs: u.startMs } : u) }).reasons).toEqual(["timestamp_order"]);
    expect(evaluateAlignedSentence(input(r), { ...r.raw, units: units.map((u, i) => i === 3 ? { ...u, startMs: units[1]!.startMs! - 20 } : u) }).reasons).toEqual(["timestamp_order"]);
    expect(evaluateAlignedSentence(input(r), { ...r.raw, units: units.map((u, i) => i === units.length - 1 ? { ...u, endMs: r.durationMs + 200 } : u) }).reasons).toEqual(["timestamp_order"]);
    expect(evaluateAlignedSentence(input(r), { ...r.raw, status: "failed", error: "no_alignment_path" }).status).toBe("failed");
  });

  it("cue times keep the existing split, start on the first spoken unit (within 60ms of the true phrase start) and leave no gap, overlap or zero length", () => {
    for (const name of ["ko", "mixed", "numbers"]) {
      const r = row(name); const result = evaluateAlignedSentence(input(r), r.raw); let cp = 0; const ranges: [number, number][] = [];
      for (const phrase of r.phrases!) { const end = cp + [...phrase].length; ranges.push([cp, end]); cp = end + 1; }
      const segment = { segmentId: r.raw.sentenceId, startMs: 1000, endMs: 1000 + r.durationMs, text: r.text } as AudioMasterTimeline["segments"][number];
      const timing = alignedCueTiming(segment, ranges, result)!; expect(timing.times).toHaveLength(ranges.length);
      expect(timing.times[0]!.startMs).toBe(1000); expect(timing.times.at(-1)!.endMs).toBe(1000 + r.durationMs);
      for (const [i, t] of timing.times.entries()) { expect(t.endMs).toBeGreaterThan(t.startMs); if (i) expect(t.startMs).toBe(timing.times[i - 1]!.endMs); }
      for (const [i, t] of timing.times.slice(1).entries()) expect(Math.abs(t.startMs - 1000 - r.truthOnsetsMs![i + 1]!), `${name} cue ${i + 2}`).toBeLessThanOrEqual(60);
    }
    const mixed = row("mixed"); const result = evaluateAlignedSentence(input(mixed), mixed.raw);
    const segment = { segmentId: mixed.raw.sentenceId, startMs: 0, endMs: mixed.durationMs, text: mixed.text } as AudioMasterTimeline["segments"][number];
    // A cue that begins with a Latin word has no checkable reading at its boundary: flagged, not silently trusted.
    expect(alignedCueTiming(segment, [[0, 4], [5, mixed.text.length]], result)!.flags).toEqual([["wildcard_only"], ["boundary_wildcard"]]);
    // A split inside a unit cannot be timed from the units: no alignment times (the caller falls back to labeled estimates).
    expect(alignedCueTiming(segment, [[0, 16], [16, [...mixed.text].length]], result)).toBeNull();
    expect(alignedCueTiming(segment, [[0, [...mixed.text].length]], { ...result, status: "review_required" })).toBeNull();
  });
});
