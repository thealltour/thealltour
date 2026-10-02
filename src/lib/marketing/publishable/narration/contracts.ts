import { z } from "zod";

export const sentenceSchema = z.object({
  sentenceId: z.string().uuid(),
  order: z.number().int().nonnegative(),
  text: z.string().trim().min(1).max(2000),
  purpose: z.string().trim().max(300).nullable(),
}).strict();
export const lineageSchema = z.object({
  assetId: z.string().min(1), canonicalVersion: z.number().int().positive(),
  sourceRevision: z.string().min(1), canonicalFingerprint: z.string().length(64),
}).strict();
export const narrationSchema = z.object({
  contract: z.literal("editorial-narration-v1"), candidateId: z.string().min(1),
  revision: z.number().int().positive(), fingerprint: z.string().length(64),
  lineage: lineageSchema, sentences: z.array(sentenceSchema).min(1).max(16),
  createdAt: z.string().datetime(),
  approval: z.object({ revision: z.number().int().positive(), fingerprint: z.string().length(64), approvedAt: z.string().datetime() }).strict().nullable(),
}).strict();
export const mutationSchema = z.object({
  action: z.enum(["save", "approve"]),
  expectedRevision: z.number().int().positive().nullable(),
  expectedFingerprint: z.string().length(64).nullable(),
  lineage: lineageSchema,
  sentences: z.array(z.object({
    sentenceId: z.string().uuid().nullable(), text: z.string().trim().min(1).max(2000),
    purpose: z.string().trim().max(300).nullable(),
  }).strict()).min(1).max(16).optional(),
}).strict();
export type Narration = z.infer<typeof narrationSchema>;
export type NarrationLineage = z.infer<typeof lineageSchema>;
export type NarrationMutation = z.infer<typeof mutationSchema>;
export type NarrationView = {
  narration: Narration | null; lineage: NarrationLineage;
  gateState: "missing" | "draft" | "approved" | "stale"; canEdit: boolean;
};
