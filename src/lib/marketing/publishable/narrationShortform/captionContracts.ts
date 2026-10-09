import { z } from "zod";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
const ms = z.number().int().nonnegative();
export const CAPTION_PLAN_CONTRACT = "narration-caption-plan-v1" as const;
export const CAPTION_DURATION = { targetMinMs: 1000, targetMaxMs: 2800, allowedMinMs: 800, allowedMaxMs: 3500 } as const;
/** sourceStart/sourceEnd are Unicode code point offsets [start, end) into the normalized sentence text, not UTF-16 indexes. */
export const captionCueSchema = z.object({ cueId: z.string().uuid(), sentenceId: z.string().uuid(), ordinal: z.number().int().positive(),
  sourceStart: ms, sourceEnd: z.number().int().positive(), text: z.string().min(1).max(400), startMs: ms, endMs: z.number().int().positive(),
  timingSource: z.enum(["forced_alignment", "manual", "estimated"]), reviewed: z.boolean() }).strict();
export const captionLineageSchema = z.object({ narrationRevision: z.number().int().positive(), narrationFingerprint: hash, audioJobId: z.string().uuid(),
  audioTimelineFingerprint: hash, processedAudioFingerprint: hash.nullable(), normalizedTextFingerprint: hash }).strict();
export const captionPlanSchema = z.object({ contract: z.literal(CAPTION_PLAN_CONTRACT), candidateId: z.string().min(1), revision: z.number().int().positive(), fingerprint: hash,
  approval: z.object({ revision: z.number().int().positive(), fingerprint: hash, approvedAt: z.string().datetime() }).strict().nullable(),
  lineage: captionLineageSchema, layoutPolicyId: z.enum(["cross-platform-conservative-v1", "cross-platform-conservative-v2"]), layoutPolicyFingerprint: hash, fontFileSha256: hash,
  cues: z.array(captionCueSchema).min(1).max(400), updatedAt: z.string().datetime(),
  /** Present when any cue uses forced_alignment: the alignment those times came from (audio bytes + text identity, and the result). */
  alignment: z.object({ jobId: z.string().uuid(), audioTextFingerprint: hash, resultFingerprint: hash }).strict().optional() }).strict();
const base = { expectedRevision: z.number().int().positive().nullable(), expectedFingerprint: hash.nullable() };
export const captionMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("generate"), ...base }).strict(),
  z.object({ action: z.literal("save"), ...base, cues: z.array(z.object({ sentenceId: z.string().uuid(), text: z.string().trim().min(1).max(400),
    startMs: ms.nullable(), endMs: z.number().int().positive().nullable(), reviewed: z.boolean() }).strict()).min(1).max(400) }).strict(),
  z.object({ action: z.literal("approve"), expectedRevision: z.number().int().positive(), expectedFingerprint: hash }).strict(),
  z.object({ action: z.literal("apply-alignment"), expectedRevision: z.number().int().positive(), expectedFingerprint: hash }).strict(),
]);
/** One-step approval after watching a preview rendered from exactly this plan; every cue needing attention must be acknowledged by ID. */
export const captionBulkApprovalSchema = z.object({ action: z.literal("approve-all"), expectedRevision: z.number().int().positive(), expectedFingerprint: hash,
  previewJobId: z.string().uuid(), acknowledgedCueIds: z.array(z.string().uuid()).max(400) }).strict();
export type CaptionCue = z.infer<typeof captionCueSchema>;
export type CaptionPlan = z.infer<typeof captionPlanSchema>;
export type CaptionMutation = z.infer<typeof captionMutationSchema>;
export type CaptionBulkApproval = z.infer<typeof captionBulkApprovalSchema>;
export type CaptionIssue = { severity: "error" | "warning"; code: string; cueId: string | null; sentenceId: string | null; message: string };
