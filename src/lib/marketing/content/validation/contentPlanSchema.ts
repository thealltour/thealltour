import { z } from "zod";

import { CONTENT_PLAN_CONTRACT } from "@/lib/marketing/content/types";
import { CONTENT_PROPOSITION_CONTRACT } from "@/lib/marketing/content/proposition/contracts";

export const CONTENT_PLAN_MAX_FACTS = 16;
export const CONTENT_PLAN_MAX_EVIDENCE = 16;
export const CONTENT_PLAN_MAX_STRING = 2000;
export const CONTENT_PLAN_MAX_SHORT = 400;
export const CONTENT_PLAN_MAX_OUTLINE = 12;
export const CONTENT_PLAN_MAX_FORMATS = 8;

const boundedString = (max: number) => z.string().max(max);

export const assignmentEvidenceRefSchema = z.object({
  evidenceId: boundedString(64),
  sourceId: boundedString(64),
  sourceType: boundedString(64).nullable(),
  sourceName: boundedString(200).nullable(),
  isOfficial: z.boolean(),
  evidenceType: boundedString(64),
  url: boundedString(2000).nullable(),
  reference: boundedString(500).nullable(),
  excerpt: boundedString(CONTENT_PLAN_MAX_STRING).nullable(),
  publishedAt: boundedString(64).nullable(),
  observedAt: boundedString(64),
  credibilityHint: z.number().min(0).max(1).nullable(),
});

export const contentFormatRecommendationSchema = z.object({
  format: z.enum(["threads_text", "instagram_carousel", "blog_article", "short_video_concept"]),
  score: z.number().min(0).max(1),
  rationale: boundedString(CONTENT_PLAN_MAX_SHORT),
});

const stringArray = (maxItems: number, maxLen = CONTENT_PLAN_MAX_SHORT) =>
  z.array(boundedString(maxLen)).max(maxItems);

const proofRequirementSchema = z.object({
  claimArea: boundedString(160),
  requiredProof: boundedString(240),
  severity: z.enum(["must", "should", "nice"]).default("should"),
});

export const contentPropositionSchema = z.object({
  contract: z.literal(CONTENT_PROPOSITION_CONTRACT).default(CONTENT_PROPOSITION_CONTRACT),
  primaryAudience: boundedString(200),
  audienceProblem: boundedString(280),
  audienceTension: boundedString(320).default(""),
  whyNow: boundedString(280).nullable().default(null),
  contentPromise: boundedString(400),
  readerGain: boundedString(400),
  specificTakeaways: stringArray(5, 200).default([]),
  proofRequirements: z.array(proofRequirementSchema).max(8).default([]),
  contentGapUsed: boundedString(320).default(""),
  engagementMechanism: boundedString(80),
  desiredAudienceAction: boundedString(40),
  angle: boundedString(280).default(""),
  keyMessage: boundedString(280).default(""),
  commercialIntent: boundedString(40).default("informational"),
  channelIntentHints: z
    .object({
      threads: boundedString(120).optional(),
      shortform: boundedString(120).optional(),
      naver_blog: boundedString(120).optional(),
      naver_band: boundedString(120).optional(),
      kakao_channel: boundedString(120).optional(),
    })
    .nullable()
    .optional()
    .default(null),
  propositionStrength: z.enum(["strong", "usable", "weak", "insufficient"]),
  limitations: stringArray(12, 200).default([]),
});

/** Canonical runtime ContentPlan — all fields required after successful validation. */
export const contentPlanCanonicalSchema = z.object({
  contract: z.literal(CONTENT_PLAN_CONTRACT),
  assignmentId: boundedString(128),
  recommendedFormats: z.array(contentFormatRecommendationSchema).max(CONTENT_PLAN_MAX_FORMATS),
  targetChannels: z
    .array(
      z.enum(["threads", "shortform", "naver_blog", "naver_band", "kakao_channel"]),
    )
    .max(8)
    .optional(),
  primaryAngle: boundedString(CONTENT_PLAN_MAX_STRING),
  keyMessage: boundedString(CONTENT_PLAN_MAX_STRING),
  targetAudience: boundedString(CONTENT_PLAN_MAX_SHORT),
  hook: boundedString(CONTENT_PLAN_MAX_SHORT),
  outline: stringArray(CONTENT_PLAN_MAX_OUTLINE),
  factsToUse: stringArray(CONTENT_PLAN_MAX_FACTS),
  factsToAvoid: stringArray(8),
  ctaStrategy: boundedString(CONTENT_PLAN_MAX_SHORT),
  productLinkageStrategy: boundedString(CONTENT_PLAN_MAX_SHORT),
  evidenceRefs: z.array(assignmentEvidenceRefSchema).max(CONTENT_PLAN_MAX_EVIDENCE),
  requiredAssets: stringArray(12),
  riskNotes: stringArray(12),
  draftInstructions: stringArray(12),
  proposition: contentPropositionSchema.optional().nullable(),
});

/**
 * Provider structured output — evidenceRefs intentionally optional (no silent default).
 * Other omitted arrays default to empty for optional semantic fields only.
 */
export const contentPlanProviderSchema = z
  .object({
    contract: z.literal(CONTENT_PLAN_CONTRACT).optional(),
    assignmentId: boundedString(128),
    recommendedFormats: z.array(contentFormatRecommendationSchema).max(CONTENT_PLAN_MAX_FORMATS).optional(),
    targetChannels: z
      .array(
        z.enum(["threads", "shortform", "naver_blog", "naver_band", "kakao_channel"]),
      )
      .max(8)
      .optional(),
    primaryAngle: boundedString(CONTENT_PLAN_MAX_STRING).optional(),
    keyMessage: boundedString(CONTENT_PLAN_MAX_STRING).optional(),
    targetAudience: boundedString(CONTENT_PLAN_MAX_SHORT).optional(),
    hook: boundedString(CONTENT_PLAN_MAX_SHORT).optional(),
    outline: stringArray(CONTENT_PLAN_MAX_OUTLINE).optional(),
    factsToUse: stringArray(CONTENT_PLAN_MAX_FACTS).optional(),
    factsToAvoid: stringArray(8).optional(),
    ctaStrategy: boundedString(CONTENT_PLAN_MAX_SHORT).optional(),
    productLinkageStrategy: boundedString(CONTENT_PLAN_MAX_SHORT).optional(),
    evidenceRefs: z.array(assignmentEvidenceRefSchema).max(CONTENT_PLAN_MAX_EVIDENCE).optional(),
    requiredAssets: stringArray(12).optional(),
    riskNotes: stringArray(12).optional(),
    draftInstructions: stringArray(12).optional(),
    proposition: contentPropositionSchema.optional().nullable(),
  })
  .strict();

export type ContentPlanProviderShape = z.infer<typeof contentPlanProviderSchema>;
