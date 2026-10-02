import { z } from "zod";
import { sceneSourceSchema } from "../narrationScenes/contracts";
export const cardCopySchema = z.object({
  sceneId: z.string().uuid(), kicker: z.string().trim().max(40).nullable(),
  headline: z.string().trim().min(1).max(80), body: z.string().trim().max(400).nullable(),
  microcopy: z.string().trim().max(120).nullable(),
}).strict();
export const derivedCardSchema = cardCopySchema.extend({
  cardId: z.string().uuid(), sentenceId: z.string().uuid(), visualId: z.string().uuid(), order: z.number().int().nonnegative(),
  image: z.object({ relativePath: z.string(), sha256: z.string().length(64) }).strict(),
  crop: z.literal("center-4:5"),
}).strict();
export const instagramSourceSchema = z.object({
  scenePlanRevision: z.number().int().positive(), scenePlanFingerprint: z.string().length(64), upstream: sceneSourceSchema,
}).strict();
export const instagramAdaptationSchema = z.object({
  contract: z.literal("narration-instagram-adaptation-v1"), candidateId: z.string().min(1),
  revision: z.number().int().positive(), fingerprint: z.string().length(64), source: instagramSourceSchema,
  cards: z.array(derivedCardSchema).min(4).max(10), createdAt: z.string().datetime(),
  approval: z.object({ revision: z.number().int().positive(), fingerprint: z.string().length(64), approvedAt: z.string().datetime() }).strict().nullable(),
}).strict();
export const instagramResultSchema = z.object({
  contract: z.literal("narration-instagram-chatgpt-result-v1"), candidateId: z.string().min(1),
  source: instagramSourceSchema, baseRevision: z.number().int().positive().nullable(), baseFingerprint: z.string().length(64).nullable(),
  visualInventoryFingerprint: z.string().length(64),
  cards: z.array(cardCopySchema).min(4).max(10),
}).strict();
export const instagramMutationSchema = z.object({
  action: z.enum(["save", "approve", "handoff", "import", "render"]),
  expectedRevision: z.number().int().positive().nullable(), expectedFingerprint: z.string().length(64).nullable(),
  expectedScenePlanFingerprint: z.string().length(64),
  cards: z.array(cardCopySchema).min(4).max(10).optional(), result: instagramResultSchema.optional(),
}).strict();
export type InstagramAdaptation = z.infer<typeof instagramAdaptationSchema>;
export type InstagramMutation = z.infer<typeof instagramMutationSchema>;
export type InstagramCardCopy = z.infer<typeof cardCopySchema>;
