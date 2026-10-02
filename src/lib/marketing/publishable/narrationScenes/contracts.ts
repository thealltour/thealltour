import { z } from "zod";
import { lineageSchema } from "../narration/contracts";

export const sceneSourceSchema = z.object({
  candidateId: z.string().min(1), canonical: lineageSchema,
  narrationRevision: z.number().int().positive(), narrationFingerprint: z.string().length(64),
  audioJobId: z.string().uuid(), audioConfigFingerprint: z.string().length(64), timelineFingerprint: z.string().length(64),
}).strict();
export const narrationSceneSchema = z.object({
  sentenceId: z.string().uuid(), sceneId: z.string().uuid(), visualId: z.string().uuid(),
  order: z.number().int().nonnegative(), sentenceText: z.string().min(1).max(2000), purpose: z.string().max(300).nullable(),
  startMs: z.number().int().nonnegative(), speechDurationMs: z.number().int().positive(),
  speechEndMs: z.number().int().positive(), sceneEndMs: z.number().int().positive(),
  visualPrompt: z.string().trim().min(1).max(6000), aspectRatio: z.literal("9:16"),
  generatedVisualCount: z.literal(1),
}).strict();
export const narrationScenePlanSchema = z.object({
  contract: z.literal("narration-scene-plan-v1"), revision: z.number().int().positive(), fingerprint: z.string().length(64),
  source: sceneSourceSchema, scenes: z.array(narrationSceneSchema).min(1).max(16),
  totalDurationMs: z.number().int().positive(), createdAt: z.string().datetime(),
  approval: z.object({ revision: z.number().int().positive(), fingerprint: z.string().length(64), approvedAt: z.string().datetime() }).strict().nullable(),
}).strict();
export const sceneHandoffSchema = z.object({
  contract: z.literal("narration-astra-handoff-v1"), planRevision: z.number().int().positive(), planFingerprint: z.string().length(64),
  source: sceneSourceSchema, fingerprint: z.string().length(64), instructions: z.array(z.string()),
  visuals: z.array(z.object({ sentenceId: z.string().uuid(), sceneId: z.string().uuid(), visualId: z.string().uuid(),
    order: z.number().int().nonnegative(), sentenceText: z.string(), visualPrompt: z.string(), aspectRatio: z.literal("9:16"),
    expectedFilename: z.string(), startMs: z.number().int().nonnegative(), sceneEndMs: z.number().int().positive(),
  }).strict()).min(1).max(16),
}).strict();
export const sceneAssetSchema = z.object({
  sentenceId: z.string().uuid(), sceneId: z.string().uuid(), visualId: z.string().uuid(),
  planFingerprint: z.string().length(64), handoffFingerprint: z.string().length(64),
  relativePath: z.string(), sha256: z.string().length(64), width: z.number().int().positive(), height: z.number().int().positive(),
  uploadedAt: z.string().datetime(),
}).strict();
export const sceneAssetsSchema = z.object({ contract: z.literal("narration-scene-assets-v1"),
  planFingerprint: z.string().length(64), handoffFingerprint: z.string().length(64),
  assets: z.array(sceneAssetSchema).max(16),
}).strict();
export const sceneMutationSchema = z.object({
  action: z.enum(["save", "approve", "handoff"]), audioJobId: z.string().uuid(),
  expectedRevision: z.number().int().positive().nullable(), expectedFingerprint: z.string().length(64).nullable(),
  expectedNarrationRevision: z.number().int().positive(), expectedNarrationFingerprint: z.string().length(64),
  prompts: z.array(z.object({ sentenceId: z.string().uuid(), visualPrompt: z.string().trim().min(1).max(6000) }).strict()).min(1).max(16).optional(),
}).strict();
export type NarrationScenePlan = z.infer<typeof narrationScenePlanSchema>;
export type SceneHandoff = z.infer<typeof sceneHandoffSchema>;
export type SceneAssets = z.infer<typeof sceneAssetsSchema>;
export type SceneMutation = z.infer<typeof sceneMutationSchema>;
