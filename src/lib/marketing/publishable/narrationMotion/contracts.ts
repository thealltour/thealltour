import { z } from "zod";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const motionChoiceSchema = z.object({ preset: z.enum(["parallax", "pan_zoom", "light_shadow", "static"]), strength: z.enum(["low", "standard"]) }).strict();
export const motionSourceSchema = z.object({ candidateId: z.string().min(1), planFingerprint: hash,
  sentenceId: z.string().uuid(), sceneId: z.string().uuid(), visualId: z.string().uuid(), imageSha256: hash,
  imageRelativePath: z.string(), startFrame: z.number().int().nonnegative(), endFrame: z.number().int().positive(),
}).strict();
export const motionConfigSchema = z.object({ version: z.literal("scene-motion-v1"), preset: motionChoiceSchema.shape.preset,
  strength: motionChoiceSchema.shape.strength, width: z.literal(720), height: z.literal(1280), fps: z.literal(30),
  horizontal: z.number(), vertical: z.number(), zoom: z.number(), lightGain: z.number(), depthModelSha256: hash.nullable(),
  runnerSha256: hash, crf: z.literal(16), threads: z.literal(4),
}).strict();
export const motionOutputSchema = z.object({ relativePath: z.string(), sha256: hash, byteSize: z.number().int().positive(),
  width: z.literal(720), height: z.literal(1280), fps: z.literal(30), frameCount: z.number().int().positive(),
  durationMs: z.number().int().positive(), manifestRelativePath: z.string(), manifestSha256: hash,
}).strict();
export const motionJobSchema = z.object({ contract: z.literal("narration-scene-motion-job-v1"), jobId: z.string().uuid(),
  inputFingerprint: hash, source: motionSourceSchema, config: motionConfigSchema,
  status: z.enum(["queued", "running", "completed", "failed", "stale"]), errorCode: z.string().nullable(),
  createdAt: z.string().datetime(), startedAt: z.string().datetime().nullable(), heartbeatAt: z.string().datetime().nullable(),
  completedAt: z.string().datetime().nullable(), output: motionOutputSchema.nullable(),
  approval: z.object({ inputFingerprint: hash, outputSha256: hash, approvedAt: z.string().datetime() }).strict().nullable(),
}).strict();
export const motionSettingsSchema = z.object({ contract: z.literal("narration-scene-motion-settings-v1"), revision: z.number().int().positive(),
  fingerprint: hash, planFingerprint: hash, scenes: z.array(z.object({ visualId: z.string().uuid(), choice: motionChoiceSchema }).strict()).max(16),
}).strict();
export const motionMutationSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save"), expectedPlanFingerprint: hash, expectedSettingsFingerprint: hash.nullable(),
    scenes: z.array(z.object({ visualId: z.string().uuid(), choice: motionChoiceSchema }).strict()).min(1).max(16) }).strict(),
  z.object({ action: z.literal("generate"), expectedPlanFingerprint: hash, expectedSettingsFingerprint: hash,
    visualIds: z.array(z.string().uuid()).min(1).max(16) }).strict(),
  z.object({ action: z.literal("approve"), expectedPlanFingerprint: hash, expectedSettingsFingerprint: hash,
    jobs: z.array(z.object({ jobId: z.string().uuid(), expectedOutputSha256: hash }).strict()).min(1).max(16) }).strict(),
]);
export type MotionChoice = z.infer<typeof motionChoiceSchema>;
export type MotionJob = z.infer<typeof motionJobSchema>;
export type MotionSettings = z.infer<typeof motionSettingsSchema>;
