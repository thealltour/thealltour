import { z } from "zod";

import { assignmentEvidenceRefSchema } from "@/lib/marketing/content/validation/contentPlanSchema";

export const MEDIA_BRIEF_CONTRACT = "media-brief-v1" as const;
export const MARKETING_ASSET_MANIFEST_CONTRACT = "marketing-asset-manifest-v1" as const;
export const MARKETING_ASSET_EXPORT_CONTEXT_CONTRACT = "marketing-asset-export-context-v1" as const;

export const MARKETING_ASSET_STAGE = ["source"] as const;
export type MarketingAssetStage = (typeof MARKETING_ASSET_STAGE)[number];

export const MARKETING_ASSET_ARTIFACT_KINDS = [
  "media_brief",
  "copy",
  "context",
  "cardnews",
  "reel_prompt",
  "reel_audio",
  "reel_subtitle",
  "reel_video",
  "human_edited",
  "published",
] as const;
export type MarketingAssetArtifactKind = (typeof MARKETING_ASSET_ARTIFACT_KINDS)[number];

export const MARKETING_ASSET_ARTIFACT_ORIGINS = [
  "pipeline_export",
  "media_brief",
  "candidate_copy",
  "cardnews_render",
  "tts_generation",
  "video_shot_planning",
  "video_clip_intake",
  "human_edit",
  "published",
] as const;
export type MarketingAssetArtifactOrigin = (typeof MARKETING_ASSET_ARTIFACT_ORIGINS)[number];

export const CARD_NEWS_ROLES = ["cover", "information", "evidence", "cta"] as const;
export type CardNewsRole = (typeof CARD_NEWS_ROLES)[number];

const boundedString = (max: number) => z.string().max(max);

export const mediaBriefFactualClaimSchema = z
  .object({
    factId: boundedString(128),
    statement: boundedString(2000),
    evidenceRefs: z.array(boundedString(64)).max(16),
    confidence: z.enum(["high", "medium", "low"]),
  })
  .strict();

export const cardNewsCardSchema = z
  .object({
    cardId: boundedString(64),
    role: z.enum(CARD_NEWS_ROLES),
    headline: boundedString(400),
    body: boundedString(2000),
    visualIntent: boundedString(400),
    evidenceRefs: z.array(boundedString(64)).max(8),
  })
  .strict();

export const cardNewsBriefSchema = z
  .object({
    enabled: z.boolean(),
    aspectRatio: z.enum(["4:5", "1:1", "9:16"]).nullable(),
    cards: z.array(cardNewsCardSchema).max(12),
    brandingIntent: boundedString(400).nullable(),
  })
  .strict();

export const shortformNarrationSegmentSchema = z
  .object({
    segmentId: boundedString(64),
    narrationText: boundedString(2000),
    subtitleText: boundedString(2000),
    purpose: boundedString(128),
    visualIntent: boundedString(400),
    evidenceRefs: z.array(boundedString(64)).max(8),
  })
  .strict();

export const shortformBriefSchema = z
  .object({
    enabled: z.boolean(),
    orientation: z.literal("vertical"),
    targetDurationRange: z
      .object({
        minSeconds: z.number().int().positive().nullable(),
        maxSeconds: z.number().int().positive().nullable(),
      })
      .strict()
      .nullable(),
    narrationSegments: z.array(shortformNarrationSegmentSchema).max(16),
    cta: boundedString(400).nullable(),
    voiceProfileId: boundedString(64).nullable(),
  })
  .strict();

export const textFormatBriefSchema = z
  .object({
    enabled: z.boolean(),
    title: boundedString(400).nullable(),
    body: boundedString(8000).nullable(),
  })
  .strict();

export const mediaBriefProvenanceSchema = z
  .object({
    builtFrom: z.literal("completed-marketing-candidate"),
    candidateContract: boundedString(128),
    assignmentId: boundedString(128).nullable(),
    selectedAgendaId: boundedString(128).nullable(),
    governanceReviewId: boundedString(128).nullable(),
    evidenceRefIds: z.array(boundedString(64)).max(32),
  })
  .strict();

export const mediaBriefSchema = z
  .object({
    contract: z.literal(MEDIA_BRIEF_CONTRACT),
    candidateId: boundedString(128),
    businessDateKst: boundedString(32),
    sourceChannel: boundedString(64).nullable(),
    targetChannels: z.array(boundedString(64)).max(8),
    contentIntent: boundedString(400).nullable(),
    audience: boundedString(400).nullable(),
    coreMessage: boundedString(2000).nullable(),
    factualClaims: z.array(mediaBriefFactualClaimSchema).max(16),
    evidenceRefs: z.array(assignmentEvidenceRefSchema).max(16),
    cta: boundedString(400).nullable(),
    formats: z
      .object({
        text: textFormatBriefSchema,
        cardnews: cardNewsBriefSchema,
        shortform: shortformBriefSchema,
      })
      .strict(),
    provenance: mediaBriefProvenanceSchema,
  })
  .strict();

export const marketingAssetArtifactSchema = z
  .object({
    artifactId: boundedString(64),
    kind: z.enum(MARKETING_ASSET_ARTIFACT_KINDS),
    relativePath: boundedString(500),
    mediaType: boundedString(128),
    byteSize: z.number().int().nonnegative(),
    sha256: z.string().length(64),
    createdAt: boundedString(64),
    origin: z.enum(MARKETING_ASSET_ARTIFACT_ORIGINS),
    version: z.number().int().positive(),
  })
  .strict();

export const marketingAssetManifestSchema = z
  .object({
    contract: z.literal(MARKETING_ASSET_MANIFEST_CONTRACT),
    packageId: boundedString(160),
    candidateId: boundedString(128),
    businessDateKst: boundedString(32),
    createdAt: boundedString(64),
    updatedAt: boundedString(64),
    stage: z.literal("source"),
    mediaBrief: mediaBriefSchema,
    artifacts: z.array(marketingAssetArtifactSchema).max(64),
    provenance: z
      .object({
        exportedFrom: z.literal("completed-marketing-candidate"),
        candidateContract: boundedString(128),
        assignmentId: boundedString(128).nullable(),
        generatedDirectories: z.array(boundedString(64)).max(16),
        humanEditedDirectory: z.literal("human-edited"),
        publishedDirectory: z.literal("published"),
      })
      .strict(),
    integrity: z
      .object({
        algorithm: z.literal("sha256"),
        artifactCount: z.number().int().nonnegative(),
        digest: z.string().length(64),
      })
      .strict(),
  })
  .strict();

export type MediaBrief = z.infer<typeof mediaBriefSchema>;
export type MediaBriefFactualClaim = z.infer<typeof mediaBriefFactualClaimSchema>;
export type CardNewsBrief = z.infer<typeof cardNewsBriefSchema>;
export type CardNewsCard = z.infer<typeof cardNewsCardSchema>;
export type ShortformBrief = z.infer<typeof shortformBriefSchema>;
export type ShortformNarrationSegment = z.infer<typeof shortformNarrationSegmentSchema>;
export type MarketingAssetArtifact = z.infer<typeof marketingAssetArtifactSchema>;
export type MarketingAssetManifest = z.infer<typeof marketingAssetManifestSchema>;
