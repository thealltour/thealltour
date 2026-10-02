import { z } from "zod";
import { narrationScenePlanSchema, sceneAssetSchema } from "../narrationScenes/contracts";
import { audioMasterTimelineSchema } from "@/lib/marketing/tts/timeline/contracts";
export const SHORTFORM_RENDER_CONFIG = {
  renderer: "narration-still-scenes-v1", width: 720, height: 1280, fps: 30,
  videoCodec: "libx264", audioCodec: "aac", audioSampleRate: 48000,
  subtitleMode: "soft_track", subtitleCodec: "mov_text", crf: 23, preset: "veryfast",
  transition: "hard_cut", gapPolicy: "hold_previous_scene", frameBoundary: "round_absolute_endpoints",
} as const;
export const shortformOutputSchema = z.object({
  relativePath: z.string(), sha256: z.string().length(64), byteSize: z.number().int().positive(),
  subtitlesRelativePath: z.string(), subtitlesSha256: z.string().length(64),
  measuredDurationMs: z.number().int().positive(), width: z.literal(720), height: z.literal(1280), fps: z.literal(30),
}).strict();
export const shortformJobSchema = z.object({
  contract: z.literal("narration-shortform-render-job-v1"), jobId: z.string().uuid(), candidateId: z.string().min(1),
  inputFingerprint: z.string().length(64), rendererFingerprint: z.string().length(64),
  plan: narrationScenePlanSchema, timeline: audioMasterTimelineSchema,
  images: z.array(sceneAssetSchema).min(1).max(16), createdAt: z.string().datetime(),
  status: z.enum(["queued", "running", "completed", "failed", "stale"]), errorCode: z.string().nullable(),
  output: shortformOutputSchema.nullable(),
}).strict();
export type NarrationShortformJob = z.infer<typeof shortformJobSchema>;
