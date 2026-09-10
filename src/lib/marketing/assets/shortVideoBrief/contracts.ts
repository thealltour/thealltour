/**
 * SV-3 — ShortVideoBrief contract (source-resolver input, not selection result).
 * Does not replace MediaBrief or AiVideoShotList.
 */

import { z } from "zod";

export const SHORT_VIDEO_BRIEF_CONTRACT = "short-video-brief-v1" as const;
export const SHORT_VIDEO_BRIEF_ASPECT_RATIO = "9:16" as const;

export const SHORT_VIDEO_DURATION_PRESETS = ["short", "normal", "info"] as const;
export type ShortVideoDurationPreset = (typeof SHORT_VIDEO_DURATION_PRESETS)[number];

/** Duration policy SoT — ms. */
export const SHORT_VIDEO_DURATION_PRESET_MS = {
  short: 12_000,
  normal: 18_000,
  info: 24_000,
} as const satisfies Record<ShortVideoDurationPreset, number>;

export const SHORT_VIDEO_DURATION_DEFAULT_PRESET: ShortVideoDurationPreset = "normal";

export const SHORT_VIDEO_MEDIA_PREFERENCES = ["video", "photo", "either"] as const;
export type ShortVideoMediaPreference = (typeof SHORT_VIDEO_MEDIA_PREFERENCES)[number];

const boundedString = (max: number) => z.string().max(max);

export const shortVideoSceneVisualSchema = z
  .object({
    subject: boundedString(400),
    searchQueries: z.array(boundedString(200)).max(3),
    factualVisualRequired: z.boolean(),
    mediaPreference: z.enum(SHORT_VIDEO_MEDIA_PREFERENCES),
    photoMotionAllowed: z.boolean(),
    generatedVideoAllowed: z.boolean(),
    /** Policy-level prefs only — no provider names. */
    sourcePreference: z
      .object({
        internalFirst: z.boolean(),
        stockAllowed: z.boolean(),
      })
      .strict(),
  })
  .strict();

export const shortVideoSceneRequirementSchema = z
  .object({
    sceneId: boundedString(64),
    order: z.number().int().min(1).max(16),
    targetDurationMs: z.number().int().positive(),
    narrationSegmentRefs: z.array(boundedString(64)).min(1).max(8),
    purpose: boundedString(128),
    visual: shortVideoSceneVisualSchema,
  })
  .strict();

export const shortVideoBriefNarrationSchema = z
  .object({
    segmentRefs: z.array(boundedString(64)).min(1).max(16),
    voiceProfileId: boundedString(64).nullable(),
    cta: boundedString(400).nullable(),
  })
  .strict();

export const shortVideoBriefProvenanceSchema = z
  .object({
    builtFromCandidateId: boundedString(128),
    mediaBriefArtifact: z.literal("context/media-brief.json").nullable(),
    shotListArtifact: z.literal("reel/shot-list.json").nullable(),
    durationPresetSource: z.enum(["default", "explicit", "media_brief_range", "shot_list_nearest"]),
  })
  .strict();

export const shortVideoBriefSchema = z
  .object({
    contract: z.literal(SHORT_VIDEO_BRIEF_CONTRACT),
    candidateId: boundedString(128),
    businessDateKst: boundedString(32),
    durationPreset: z.enum(SHORT_VIDEO_DURATION_PRESETS),
    targetDurationMs: z.number().int().positive(),
    aspectRatio: z.literal(SHORT_VIDEO_BRIEF_ASPECT_RATIO),
    hook: boundedString(400),
    scenes: z.array(shortVideoSceneRequirementSchema).min(1).max(16),
    narration: shortVideoBriefNarrationSchema,
    provenance: shortVideoBriefProvenanceSchema,
  })
  .strict();

export type ShortVideoSceneVisual = z.infer<typeof shortVideoSceneVisualSchema>;
export type ShortVideoSceneRequirement = z.infer<typeof shortVideoSceneRequirementSchema>;
export type ShortVideoBrief = z.infer<typeof shortVideoBriefSchema>;
