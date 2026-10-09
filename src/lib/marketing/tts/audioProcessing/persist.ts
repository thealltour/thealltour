import { existsSync, readFileSync } from "node:fs";
import { atomicWriteFile } from "@/lib/marketing/assets/atomicWrite";
import { sha256Buffer, sha256FileSync } from "@/lib/marketing/assets/hashing";
import { resolvePackageArtifactPath } from "@/lib/marketing/assets/paths";
import type { AudioDurationProbe } from "@/lib/marketing/tts/duration/probe";
import { ttsOrderedSegmentStem } from "@/lib/marketing/tts/timeline/paths";
import { AUDIO_PROCESSING_CONTRACT, audioProcessingSidecarSchema, edgeTrimPolicyFingerprint, policyAnalysisParameters, type AudioProcessingSidecar, type EdgeDecision, type EdgeTrimPolicy } from "./contracts";
import { analyzeEdges, parsePcmWav, sliceWav } from "./trimEdges";

/** Processed outputs live beside, never over, raw WAVs; the policy hash is part of the path. */
export function processedSegmentPaths(runRelativeRoot: string, ordinal: number, policyFingerprint: string) {
  const directory = `${runRelativeRoot}/processed/${policyFingerprint.slice(0, 16)}`; const stem = ttsOrderedSegmentStem(ordinal);
  return { audio: `${directory}/${stem}.wav`, sidecar: `${directory}/${stem}.processing.json` };
}
/** `policy` is the job's recorded snapshot; the current code default is never consulted here. */
export async function processNarrationSegmentAudio(input: { packageRoot: string; rawRelativePath: string; rawAudioJobId: string; sentenceId: string;
  audioRelativePath: string; sidecarRelativePath: string; durationProbe: AudioDurationProbe; policy: EdgeTrimPolicy; now?: Date }): Promise<{ sidecar: AudioProcessingSidecar; sidecarSha256: string }> {
  const resolve = (relativePath: string) => resolvePackageArtifactPath({ packageRoot: input.packageRoot, relativePath });
  const raw = readFileSync(resolve(input.rawRelativePath)); const rawAudioSha256 = sha256Buffer(raw); const { policy } = input; const policyFingerprint = edgeTrimPolicyFingerprint(policy);
  const sidecarPath = resolve(input.sidecarRelativePath); const audioPath = resolve(input.audioRelativePath);
  if (existsSync(sidecarPath)) {
    try {
      const prior = audioProcessingSidecarSchema.parse(JSON.parse(readFileSync(sidecarPath, "utf8")));
      // Reuse is keyed by raw hash + policy hash; the TTS provider is never asked again.
      if (prior.rawAudioSha256 === rawAudioSha256 && prior.policyFingerprint === policyFingerprint && prior.sentenceId === input.sentenceId && prior.status !== "failed" && !prior.edgeDecision &&
        prior.processedRelativePath === input.audioRelativePath && existsSync(audioPath) && sha256FileSync(audioPath) === prior.processedAudioSha256) return { sidecar: prior, sidecarSha256: sha256FileSync(sidecarPath) };
    } catch { /* Recompute a missing or corrupt sidecar. */ }
  }
  const base = { contract: AUDIO_PROCESSING_CONTRACT, rawAudioJobId: input.rawAudioJobId, sentenceId: input.sentenceId, rawAudioSha256, rawRelativePath: input.rawRelativePath,
    policyId: policy.policyId, policyFingerprint, algorithmVersion: policy.algorithmVersion,
    analysisParameters: policyAnalysisParameters(policy), createdAt: (input.now ?? new Date()).toISOString() };
  const write = (sidecar: AudioProcessingSidecar) => { const bytes = JSON.stringify(audioProcessingSidecarSchema.parse(sidecar), null, 2); atomicWriteFile(sidecarPath, bytes, 0o600); return { sidecar, sidecarSha256: sha256Buffer(bytes) }; };
  let wav: ReturnType<typeof parsePcmWav>;
  try { wav = parsePcmWav(raw); }
  catch (error) {
    return write({ ...base, rawSampleRate: null, rawSampleCount: null, detectedSpeechStartSample: null, detectedSpeechEndSampleExclusive: null, keptStartSample: 0, keptEndSampleExclusive: 0,
      removedLeadingSamples: 0, removedTrailingSamples: 0, processedAudioSha256: null, processedRelativePath: null, processedSampleCount: null, measuredDurationMs: null,
      status: "failed", diagnostics: [`wav_${error instanceof Error ? error.message : "unreadable"}`.slice(0, 200)] });
  }
  const analysis = analyzeEdges(raw, wav, policy); const processed = sliceWav(raw, wav, analysis.keptStartSample, analysis.keptEndSampleExclusive);
  atomicWriteFile(audioPath, processed, 0o600);
  const processedSampleCount = analysis.keptEndSampleExclusive - analysis.keptStartSample;
  const measured = await input.durationProbe.probePersistedWav(audioPath); const diagnostics = [...analysis.diagnostics];
  // The re-probed processed WAV is the duration authority; it must agree with the sample count.
  const probeAgrees = Math.abs(measured.durationMs - processedSampleCount * 1000 / wav.sampleRate) <= 1; if (!probeAgrees) diagnostics.push("probe_sample_count_mismatch");
  return write({ ...base, rawSampleRate: wav.sampleRate, rawSampleCount: wav.frameCount, detectedSpeechStartSample: analysis.detectedSpeechStartSample, detectedSpeechEndSampleExclusive: analysis.detectedSpeechEndSampleExclusive,
    keptStartSample: analysis.keptStartSample, keptEndSampleExclusive: analysis.keptEndSampleExclusive, removedLeadingSamples: analysis.keptStartSample, removedTrailingSamples: wav.frameCount - analysis.keptEndSampleExclusive,
    processedAudioSha256: sha256Buffer(processed), processedRelativePath: input.audioRelativePath, processedSampleCount, measuredDurationMs: measured.durationMs,
    status: probeAgrees ? analysis.status : "failed", diagnostics });
}
/** Writes a new WAV cut at a reviewer's raw-sample range and its receipt; never overwrites raw or another job's output. Duration is re-probed. */
export async function processNarrationSegmentRange(input: { packageRoot: string; rawRelativePath: string; rawAudioJobId: string; sentenceId: string; audioRelativePath: string; sidecarRelativePath: string;
  durationProbe: AudioDurationProbe; policy: EdgeTrimPolicy; decision: EdgeDecision; now?: Date }): Promise<{ sidecar: AudioProcessingSidecar; sidecarSha256: string }> {
  const resolve = (relativePath: string) => resolvePackageArtifactPath({ packageRoot: input.packageRoot, relativePath });
  const raw = readFileSync(resolve(input.rawRelativePath)); const wav = parsePcmWav(raw); const { decision, policy } = input; const sidecarPath = resolve(input.sidecarRelativePath); const audioPath = resolve(input.audioRelativePath);
  if (sha256Buffer(raw) !== decision.rawSha256 || wav.frameCount !== decision.rawSampleCount || wav.sampleRate !== decision.sampleRate) throw new Error("edge_decision_raw_mismatch");
  if (existsSync(audioPath) || existsSync(sidecarPath)) throw new Error("edge_decision_output_exists");
  const analysis = analyzeEdges(raw, wav, policy); const processed = sliceWav(raw, wav, decision.startSample, decision.endSampleExclusive);
  atomicWriteFile(audioPath, processed, 0o600);
  const processedSampleCount = decision.endSampleExclusive - decision.startSample; const measured = await input.durationProbe.probePersistedWav(audioPath);
  const probeAgrees = Math.abs(measured.durationMs - processedSampleCount * 1000 / wav.sampleRate) <= 1;
  const sidecar: AudioProcessingSidecar = { contract: AUDIO_PROCESSING_CONTRACT, rawAudioJobId: input.rawAudioJobId, sentenceId: input.sentenceId, rawAudioSha256: decision.rawSha256, rawRelativePath: input.rawRelativePath,
    rawSampleRate: wav.sampleRate, rawSampleCount: wav.frameCount, policyId: policy.policyId, policyFingerprint: edgeTrimPolicyFingerprint(policy), algorithmVersion: policy.algorithmVersion, analysisParameters: policyAnalysisParameters(policy),
    detectedSpeechStartSample: analysis.detectedSpeechStartSample, detectedSpeechEndSampleExclusive: analysis.detectedSpeechEndSampleExclusive, keptStartSample: decision.startSample, keptEndSampleExclusive: decision.endSampleExclusive,
    removedLeadingSamples: decision.startSample, removedTrailingSamples: wav.frameCount - decision.endSampleExclusive, processedAudioSha256: sha256Buffer(processed), processedRelativePath: input.audioRelativePath,
    processedSampleCount, measuredDurationMs: measured.durationMs, status: probeAgrees ? "ready" : "failed", diagnostics: probeAgrees ? [] : ["probe_sample_count_mismatch"],
    createdAt: (input.now ?? new Date()).toISOString(), edgeDecision: decision };
  const bytes = JSON.stringify(audioProcessingSidecarSchema.parse(sidecar), null, 2); atomicWriteFile(sidecarPath, bytes, 0o600);
  return { sidecar, sidecarSha256: sha256Buffer(bytes) };
}
