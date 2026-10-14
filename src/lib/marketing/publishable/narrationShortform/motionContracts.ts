import { z } from "zod";
import { shortformJobSchema, shortformOutputSchema } from "./contracts";
import { captionCueSchema } from "./captionContracts";
import { stockRenderAssetSchema, visualSourcesRenderSchema } from "../narrationVisualSources/contracts";
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const motionRenderConfigSchema = z.object({ renderer: z.literal("narration-motion-scenes-v2"), width: z.literal(720), height: z.literal(1280), fps: z.literal(30),
  subtitleMode: z.literal("burned_sentence"), fontFamily: z.literal("Noto Sans CJK KR"), fontSha256: hash,
  fontSize: z.literal(38), minFontSize: z.literal(26), marginV: z.literal(210), marginH: z.literal(60), maxLineUnits: z.literal(30), maxLines: z.literal(4),
  subtitleTiming: z.literal("sentence_start_end"), videoCodec: z.literal("libx264"), audioCodec: z.literal("aac"), crf: z.literal(20), preset: z.literal("veryfast"),
  transition: z.literal("hard_cut"), gapPolicy: z.literal("hold_previous_scene"), frameBoundary: z.literal("round_absolute_endpoints"),
}).strict();
export const motionRenderAssetSchema = z.object({ visualId: z.string().uuid(), jobId: z.string().uuid(), inputFingerprint: hash,
  outputSha256: hash, relativePath: z.string(), frameCount: z.number().int().positive() }).strict();
export const motionShortformJobSchema = shortformJobSchema.extend({ contract: z.literal("narration-shortform-render-job-v2"),
  motionAssets: z.array(motionRenderAssetSchema).min(1).max(16), renderConfig: motionRenderConfigSchema,
  startedAt: z.string().datetime().nullable(), heartbeatAt: z.string().datetime().nullable(),
  output: shortformOutputSchema.extend({ assRelativePath: z.string(), assSha256: hash }).strict().nullable(),
}).strict();
export type MotionShortformJob = z.infer<typeof motionShortformJobSchema>;
/** v3 burns reviewed caption cues and the opening hook at fixed safe-area anchors. v2 jobs keep their own reader and are never reinterpreted. */
const captionRenderConfigBase = { renderer: z.literal("narration-motion-scenes-v3"), width: z.literal(720), height: z.literal(1280), fps: z.literal(30),
  subtitleMode: z.literal("burned_caption_cues"), fontFamily: z.literal("Noto Sans CJK KR"), fontWeight: z.literal("bold"), fontSha256: hash,
  layoutPolicyFingerprint: hash, platformValidation: z.literal("pending"),
  captionFontSize: z.literal(40), hookFontSize: z.literal(48), maxLines: z.literal(2), autoShrink: z.literal(false), previewGuideBurned: z.literal(false),
  videoCodec: z.literal("libx264"), audioCodec: z.literal("aac"), crf: z.literal(20), preset: z.literal("veryfast"),
  transition: z.literal("hard_cut"), gapPolicy: z.literal("hold_previous_scene"), frameBoundary: z.literal("round_absolute_endpoints") };
/** Policy v1 wrote the design size directly as ASS FontSize. Readable only; such jobs are always stale and never re-rendered under v2. */
export const legacyCaptionRenderConfigSchema = z.object({ ...captionRenderConfigBase, layoutPolicyId: z.literal("cross-platform-conservative-v1") }).strict();
/** Policy v2: caption/hook sizes are em; the derived ASS FontSize for the pinned font is recorded. */
export const captionRenderConfigSchema = z.object({ ...captionRenderConfigBase, layoutPolicyId: z.literal("cross-platform-conservative-v2"), fontSizeBasis: z.literal("em"),
  captionAssFontSize: z.number().positive(), hookAssFontSize: z.number().positive() }).strict();
export const captionShortformJobV3Schema = motionShortformJobSchema.extend({ contract: z.literal("narration-shortform-render-job-v3"), renderConfig: z.union([captionRenderConfigSchema, legacyCaptionRenderConfigSchema]),
  purpose: z.enum(["preview", "final"]),
  captionPlan: z.object({ fingerprint: hash, revision: z.number().int().positive(), approved: z.boolean(), cues: z.array(captionCueSchema).min(1).max(400) }).strict(),
  hook: z.object({ fingerprint: hash, contentFingerprint: hash, revision: z.number().int().positive(), approved: z.boolean(), enabled: z.boolean(), text: z.string().max(80),
    startMs: z.literal(0), endMs: z.number().int().positive(), templateId: z.literal("opening-top-v1") }).strict().nullable(),
  /** Final only: explicit "keep raw length" decisions for every review_required segment of the bound audio job. */
  audioReview: z.array(z.object({ sentenceId: z.string().uuid(), rawSha256: hash, processedSha256: hash, policyFingerprint: hash }).strict()).max(16),
  output: shortformOutputSchema.extend({ assRelativePath: z.string(), assSha256: hash, layoutCheckedItems: z.number().int().positive() }).strict().nullable(),
}).strict();
/**
 * v4 is written only when at least one scene uses an approved stock clip. Scene assets are either the unchanged motion
 * asset or a stock clip asset, and the selection fingerprint is part of the input. Jobs without stock stay v3 with
 * byte-identical inputs and hashes.
 */
export const sceneRenderAssetSchema = z.union([motionRenderAssetSchema, stockRenderAssetSchema]);
export const captionShortformJobV4Schema = captionShortformJobV3Schema.extend({ contract: z.literal("narration-shortform-render-job-v4"),
  motionAssets: z.array(sceneRenderAssetSchema).min(1).max(16), visualSources: visualSourcesRenderSchema }).strict();
export const captionShortformJobSchema = z.discriminatedUnion("contract", [captionShortformJobV3Schema, captionShortformJobV4Schema]);
export type CaptionShortformJob = z.infer<typeof captionShortformJobSchema>;
export type SceneRenderAsset = z.infer<typeof sceneRenderAssetSchema>;
