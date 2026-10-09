import { z } from "zod";
import { sha256Buffer, stableJsonBytes } from "@/lib/marketing/assets/hashing";

export const AUDIO_PROCESSING_CONTRACT = "narration-audio-processing-v1" as const;
/** Edge-only silence trim. Internal pauses and the 250ms inter-sentence timeline pause are never touched; cuts are sample-index only. */
export const edgeTrimPolicySchema = z.object({
  policyId: z.string().regex(/^[a-z0-9-]{1,64}$/), algorithmVersion: z.literal("edge-rms-window-v1"),
  analysis: z.object({ thresholdDbfs: z.number().min(-90).max(0), windowMs: z.number().int().positive(), minQuietRunMs: z.number().int().positive() }).strict(),
  guards: z.object({ leadingMs: z.number().int().nonnegative(), trailingMs: z.number().int().nonnegative() }).strict(),
  review: z.object({ maxSideTrimMs: z.number().int().positive(), maxTotalTrimRatio: z.number().gt(0).max(1), minKeptMs: z.number().int().positive() }).strict(),
  onReviewRequired: z.literal("keep_raw_range"), retiming: z.literal("sample_cut_only"), interSegmentPauseMs: z.literal(250),
}).strict();
export type EdgeTrimPolicy = z.infer<typeof edgeTrimPolicySchema>;
export const EDGE_TRIM_POLICY: EdgeTrimPolicy = {
  policyId: "edge-energy-trim-v1", algorithmVersion: "edge-rms-window-v1",
  analysis: { thresholdDbfs: -45, windowMs: 10, minQuietRunMs: 100 },
  guards: { leadingMs: 80, trailingMs: 120 },
  review: { maxSideTrimMs: 1500, maxTotalTrimRatio: 0.4, minKeptMs: 200 },
  onReviewRequired: "keep_raw_range", retiming: "sample_cut_only", interSegmentPauseMs: 250,
};
/** Default for new jobs only. Existing jobs are verified against the policy snapshot they recorded, never against this. */
export const currentEdgeTrimPolicy = (): EdgeTrimPolicy => EDGE_TRIM_POLICY;
export const edgeTrimPolicyFingerprint = (policy: EdgeTrimPolicy) => sha256Buffer(stableJsonBytes(edgeTrimPolicySchema.parse(policy)));
export const policyAnalysisParameters = (policy: EdgeTrimPolicy) => ({ ...policy.analysis, leadingGuardMs: policy.guards.leadingMs, trailingGuardMs: policy.guards.trailingMs });
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const sample = z.number().int().nonnegative();
/**
 * A reviewer's explicit edge range for one raw WAV, in raw sample indices (ms is display only). Only the leading/trailing edges move;
 * nothing inside [startSample, endSampleExclusive) is removed, joined or re-timed. Bound to the raw bytes it was chosen on.
 */
export const edgeDecisionSchema = z.object({ mode: z.enum(["auto_range", "manual_range"]), rawSha256: hash, rawSampleCount: z.number().int().positive(), sampleRate: z.number().int().positive(),
  startSample: sample, endSampleExclusive: z.number().int().positive(), warnings: z.array(z.string().max(80)).max(10), acknowledgedWarnings: z.array(z.string().max(80)).max(10), decidedAt: z.string().datetime() }).strict()
  .refine(d => d.startSample < d.endSampleExclusive && d.endSampleExclusive <= d.rawSampleCount, "range").refine(d => d.warnings.every(w => d.acknowledgedWarnings.includes(w)), "acknowledged");
export type EdgeDecision = z.infer<typeof edgeDecisionSchema>;
export const audioProcessingSidecarSchema = z.object({ contract: z.literal(AUDIO_PROCESSING_CONTRACT), rawAudioJobId: z.string().uuid(), sentenceId: z.string().uuid(),
  rawAudioSha256: hash, rawRelativePath: z.string().min(1), rawSampleRate: z.number().int().positive().nullable(), rawSampleCount: sample.nullable(),
  policyId: edgeTrimPolicySchema.shape.policyId, policyFingerprint: hash, algorithmVersion: edgeTrimPolicySchema.shape.algorithmVersion,
  analysisParameters: z.object({ thresholdDbfs: z.number(), windowMs: z.number().int().positive(), minQuietRunMs: z.number().int().positive(), leadingGuardMs: z.number().int().nonnegative(), trailingGuardMs: z.number().int().nonnegative() }).strict(),
  detectedSpeechStartSample: sample.nullable(), detectedSpeechEndSampleExclusive: sample.nullable(), keptStartSample: sample, keptEndSampleExclusive: sample,
  removedLeadingSamples: sample, removedTrailingSamples: sample, processedAudioSha256: hash.nullable(), processedRelativePath: z.string().nullable(),
  processedSampleCount: sample.nullable(), measuredDurationMs: z.number().int().positive().nullable(),
  status: z.enum(["ready", "review_required", "failed"]), diagnostics: z.array(z.string().max(200)).max(20), createdAt: z.string().datetime(), edgeDecision: edgeDecisionSchema.optional() }).strict();
export type AudioProcessingSidecar = z.infer<typeof audioProcessingSidecarSchema>;
