import { EDGE_TRIM_POLICY, type EdgeTrimPolicy } from "./contracts";

export type PcmWav = { sampleRate: number; channels: number; bitsPerSample: number; floatingPoint: boolean; blockAlign: number; fmtChunk: Buffer; dataOffset: number; frameCount: number };
export class WavFormatError extends Error {}
/** PCM/IEEE-float RIFF reader. Unknown chunks are ignored; only fmt and data are carried into processed output. */
export function parsePcmWav(buffer: Buffer): PcmWav {
  if (buffer.length < 12 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") throw new WavFormatError("not_riff_wave");
  let fmt: Buffer | null = null; let data: { offset: number; length: number } | null = null;
  for (let offset = 12; offset + 8 <= buffer.length;) {
    const id = buffer.toString("ascii", offset, offset + 4); const size = buffer.readUInt32LE(offset + 4); const body = offset + 8;
    if (id === "fmt ") fmt = buffer.subarray(offset, body + size);
    if (id === "data") { data = { offset: body, length: Math.min(size, buffer.length - body) }; break; }
    offset = body + size + (size % 2);
  }
  if (!fmt || !data || fmt.length < 24) throw new WavFormatError("missing_fmt_or_data");
  const tag = fmt.readUInt16LE(8); const channels = fmt.readUInt16LE(10); const sampleRate = fmt.readUInt32LE(12); const blockAlign = fmt.readUInt16LE(20); const bitsPerSample = fmt.readUInt16LE(22);
  const subtype = tag === 0xfffe && fmt.length >= 34 ? fmt.readUInt16LE(32) : tag; const floatingPoint = subtype === 3;
  if (![1, 3].includes(subtype) || !channels || !sampleRate || blockAlign !== channels * bitsPerSample / 8 || (floatingPoint ? bitsPerSample !== 32 : ![16, 24, 32].includes(bitsPerSample))) throw new WavFormatError("unsupported_pcm_format");
  return { sampleRate, channels, bitsPerSample, floatingPoint, blockAlign, fmtChunk: fmt, dataOffset: data.offset, frameCount: Math.floor(data.length / blockAlign) };
}
function sampleAt(buffer: Buffer, wav: PcmWav, offset: number) {
  if (wav.floatingPoint) return buffer.readFloatLE(offset);
  if (wav.bitsPerSample === 16) return buffer.readInt16LE(offset) / 32768;
  if (wav.bitsPerSample === 24) return buffer.readIntLE(offset, 3) / 8388608;
  return buffer.readInt32LE(offset) / 2147483648;
}
/** `suggested*` is the guarded detected range even when it was not applied (review_required); a reviewer may choose it explicitly. */
export type EdgeAnalysis = { detectedSpeechStartSample: number | null; detectedSpeechEndSampleExclusive: number | null; keptStartSample: number; keptEndSampleExclusive: number;
  suggestedKeptStartSample: number | null; suggestedKeptEndSampleExclusive: number | null; status: "ready" | "review_required"; diagnostics: string[] };
/** Energy is evaluated only from the outside in; the first/last loud window bounds speech, so internal pauses can never be removed. */
export function analyzeEdges(buffer: Buffer, wav: PcmWav, policy: EdgeTrimPolicy = EDGE_TRIM_POLICY): EdgeAnalysis {
  const window = Math.max(1, Math.round(wav.sampleRate * policy.analysis.windowMs / 1000)); const windows = Math.ceil(wav.frameCount / window);
  const loud = (w: number) => {
    let sum = 0; let count = 0; const end = Math.min(wav.frameCount, (w + 1) * window);
    for (let frame = w * window; frame < end; frame++) for (let c = 0; c < wav.channels; c++) { const v = sampleAt(buffer, wav, wav.dataOffset + frame * wav.blockAlign + c * wav.bitsPerSample / 8); sum += v * v; count++; }
    return count > 0 && 10 * Math.log10(sum / count || 1e-20) >= policy.analysis.thresholdDbfs;
  };
  let first = -1; for (let w = 0; w < windows; w++) if (loud(w)) { first = w; break; }
  const samples = (ms: number) => Math.round(wav.sampleRate * ms / 1000);
  if (first < 0) return { detectedSpeechStartSample: null, detectedSpeechEndSampleExclusive: null, keptStartSample: 0, keptEndSampleExclusive: wav.frameCount, suggestedKeptStartSample: null, suggestedKeptEndSampleExclusive: null,
    status: "review_required", diagnostics: ["no_speech_detected"] };
  let last = first; for (let w = windows - 1; w >= first; w--) if (loud(w)) { last = w; break; }
  const speechStart = first * window; const speechEnd = Math.min(wav.frameCount, (last + 1) * window); const minQuiet = samples(policy.analysis.minQuietRunMs);
  const keptStart = speechStart >= minQuiet ? Math.max(0, speechStart - samples(policy.guards.leadingMs)) : 0;
  const keptEnd = wav.frameCount - speechEnd >= minQuiet ? Math.min(wav.frameCount, speechEnd + samples(policy.guards.trailingMs)) : wav.frameCount;
  const diagnostics = rangeTrimDiagnostics(wav, keptStart, keptEnd, policy);
  const detected = { detectedSpeechStartSample: speechStart, detectedSpeechEndSampleExclusive: speechEnd, suggestedKeptStartSample: keptStart, suggestedKeptEndSampleExclusive: keptEnd };
  // Uncertain trims are not applied: the raw range is kept and a reviewer decides.
  if (diagnostics.length) return { ...detected, keptStartSample: 0, keptEndSampleExclusive: wav.frameCount, status: "review_required", diagnostics };
  return { ...detected, keptStartSample: keptStart, keptEndSampleExclusive: keptEnd, status: "ready", diagnostics };
}
/** The policy's review limits for keeping [start, end) of the raw WAV. Shared by the automatic trim and reviewer-chosen ranges. */
export function rangeTrimDiagnostics(wav: Pick<PcmWav, "sampleRate" | "frameCount">, start: number, end: number, policy: EdgeTrimPolicy) {
  const samples = (ms: number) => Math.round(wav.sampleRate * ms / 1000); const diagnostics: string[] = []; const maxSide = samples(policy.review.maxSideTrimMs);
  if (start > maxSide) diagnostics.push("leading_trim_exceeds_1500ms");
  if (wav.frameCount - end > maxSide) diagnostics.push("trailing_trim_exceeds_1500ms");
  if (wav.frameCount && (start + wav.frameCount - end) / wav.frameCount >= policy.review.maxTotalTrimRatio) diagnostics.push("total_trim_at_least_40_percent");
  if (end - start < samples(policy.review.minKeptMs)) diagnostics.push("kept_audio_too_short");
  return diagnostics;
}
/** Peak envelope for the review waveform: `buckets` max-|sample| values in [0,1] over the whole raw WAV (all channels). */
export function wavePeaks(buffer: Buffer, wav: PcmWav, buckets: number) {
  const peaks: number[] = []; const per = Math.max(1, Math.ceil(wav.frameCount / buckets));
  for (let start = 0; start < wav.frameCount; start += per) {
    let peak = 0; const end = Math.min(wav.frameCount, start + per);
    for (let frame = start; frame < end; frame++) for (let c = 0; c < wav.channels; c++) peak = Math.max(peak, Math.abs(sampleAt(buffer, wav, wav.dataOffset + frame * wav.blockAlign + c * wav.bitsPerSample / 8)));
    peaks.push(Math.round(Math.min(1, peak) * 1000) / 1000);
  }
  return { samplesPerPeak: per, peaks };
}
/** Sample-index cut only (no resample/tempo change). The original fmt chunk is copied verbatim. */
export function sliceWav(buffer: Buffer, wav: PcmWav, start: number, end: number) {
  const data = buffer.subarray(wav.dataOffset + start * wav.blockAlign, wav.dataOffset + end * wav.blockAlign);
  const header = Buffer.alloc(12); header.write("RIFF", 0, "ascii"); header.writeUInt32LE(4 + wav.fmtChunk.length + (wav.fmtChunk.length % 2) + 8 + data.length + (data.length % 2), 4); header.write("WAVE", 8, "ascii");
  const dataHeader = Buffer.alloc(8); dataHeader.write("data", 0, "ascii"); dataHeader.writeUInt32LE(data.length, 4);
  return Buffer.concat([header, wav.fmtChunk, Buffer.alloc(wav.fmtChunk.length % 2), dataHeader, data, Buffer.alloc(data.length % 2)]);
}
