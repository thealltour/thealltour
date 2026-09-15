/**
 * CG-4A/B — Publishable channel content contracts.
 * Internal planning (contentPlan/outline) stays separate from channel-ready copy.
 *
 * Bundle contract remains publishable-channel-content-bundle-v1 with additive
 * optional channel slots (naver_blog / naver_band / kakao_channel) for backward
 * compatibility with Threads + Shortform consumers.
 */

export const PUBLISHABLE_CONTENT_BUNDLE_CONTRACT = "publishable-channel-content-bundle-v1" as const;
export const PUBLISHABLE_CHANNEL_CONTENT_CONTRACT = "publishable-channel-content-v1" as const;

/** Always generated baseline (CG-4A). */
export const PUBLISHABLE_BASELINE_CHANNELS = ["threads", "shortform"] as const;

/** Optional CG-4B channel-native outputs — only when selected. */
export const PUBLISHABLE_OPTIONAL_CHANNELS = ["naver_blog", "naver_band", "kakao_channel"] as const;

export const PUBLISHABLE_CHANNELS = [
  ...PUBLISHABLE_BASELINE_CHANNELS,
  ...PUBLISHABLE_OPTIONAL_CHANNELS,
] as const;
export type PublishableChannel = (typeof PUBLISHABLE_CHANNELS)[number];

export const PUBLISHABLE_FORMATS = [
  "threads_text",
  "short_video_narration",
  "naver_blog_article",
  "naver_band_post",
  "kakao_channel_post",
] as const;
export type PublishableFormat = (typeof PUBLISHABLE_FORMATS)[number];

export const PUBLISHABLE_CONTENT_STATUSES = [
  "generated",
  "human_edited",
  "validated",
  "fallback_generated",
  /** MQ-4 — LLM invoke failed (timeout/auth/network/etc.). Not publishable success. */
  "generation_failed",
  /** MQ-4 — model output failed deterministic validation after repair budget. */
  "validation_failed",
] as const;
export type PublishableContentStatus = (typeof PUBLISHABLE_CONTENT_STATUSES)[number];

export const PUBLISHABLE_GENERATION_FAILURE_CATEGORIES = [
  "timeout",
  "auth",
  "rate_limited",
  "upstream_5xx",
  "network",
  "invalid_json",
  "schema_validation",
  "publishability_validation",
  "topic_identity_conflict",
  "evidence_violation",
  "insufficient_proposition",
  "governance_block",
  "invoke_missing",
  "canonical_asset_unapproved",
  "unknown",
] as const;
export type PublishableGenerationFailureCategory =
  (typeof PUBLISHABLE_GENERATION_FAILURE_CATEGORIES)[number];

export type PublishableValidationIssueCode =
  | "internal_heading_leak"
  | "evidence_id_leak"
  | "assignment_id_leak"
  | "object_leak"
  | "empty_body"
  | "unsupported_claim_promoted"
  | "template_slop"
  | "keyword_stuffing"
  | "fake_urgency"
  | "unsupported_price_availability"
  | "fake_personal_experience"
  | "missing_title"
  | "too_long"
  | "too_short"
  | "json_fence_leak";

export type PublishableValidationIssue = {
  code: PublishableValidationIssueCode;
  message: string;
};

export type PublishableValidationResult = {
  ok: boolean;
  issues: PublishableValidationIssue[];
};

export type PublishableNarrationSegment = {
  segmentId: string;
  narrationText: string;
  subtitleText: string;
  purpose: string;
  visualIntent: string;
  /** Internal governance only — never spoken / never printed in body. */
  evidenceRefs: string[];
};

/** Blog-specific structured metadata (body remains the markdown export). */
export type PublishableBlogMeta = {
  selectedTitle: string;
  titleCandidates: string[];
  primaryTopic: string;
  searchIntent: string | null;
  sectionPlan: string[];
  faq: Array<{ question: string; answer: string }>;
  cta: string | null;
};

export type PublishableChannelContent = {
  contract: typeof PUBLISHABLE_CHANNEL_CONTENT_CONTRACT;
  channel: PublishableChannel;
  format: PublishableFormat;
  title: string | null;
  body: string;
  status: PublishableContentStatus;
  generatedAt: string;
  sourceCandidateId: string;
  sourceRevision: string;
  selectedAngleRef?: string | null;
  researchBriefRef?: string | null;
  provenance: {
    composer: "llm" | "deterministic_fallback" | "human";
    evidenceRefIds: string[];
    commercialIntent: string | null;
    /** MQ-4 generation telemetry (additive). */
    generationMode?: "llm" | "fallback" | "human" | "skipped";
    modelProfile?: string | null;
    attemptCount?: number;
    latencyMs?: number | null;
    failureCategory?: PublishableGenerationFailureCategory | null;
    failureMessage?: string | null;
    propositionStrength?: string | null;
    /** Records that ContentProposition drove the draft. */
    proposition?: {
      contract: string;
      selectedAngleRef?: string | null;
      contentPromise?: string | null;
      readerGain?: string | null;
      takeawayBasis?: string[];
      desiredAudienceAction?: string | null;
      engagementMechanism?: string | null;
      propositionStrength?: string | null;
    } | null;
  };
  validation: PublishableValidationResult;
  /**
   * MQ-4 — explicit publishable success gate.
   * fallback_generated / generation_failed / validation_failed ⇒ false.
   */
  publishableSuccess?: boolean;
  needsRegeneration?: boolean;
  /** MQ-5 — marketing usefulness gate (separate from Governance). */
  marketingValue?: import("@/lib/marketing/value/contracts").MarketingValueAssessment | null;
  /** Shortform only — spoken segments for ShortVideoBrief. */
  narrationSegments?: PublishableNarrationSegment[];
  /** Naver Blog structured fields (optional). */
  blogMeta?: PublishableBlogMeta;
  /** Approved Canonical Marketing Asset provenance (additive). */
  sourceAssetId?: string | null;
  sourceAssetVersion?: number | null;
  /** True when approved asset moved ahead of this channel draft. */
  stale?: boolean;
};

/**
 * Bundle: threads + shortform required (CG-4A).
 * Optional CG-4B slots only present when selected/generated.
 */
export type PublishableContentBundle = {
  contract: typeof PUBLISHABLE_CONTENT_BUNDLE_CONTRACT;
  candidateId: string;
  businessDateKst: string;
  generatedAt: string;
  sourceRevision: string;
  /** Channels intentionally generated for this revision. */
  targetChannels: PublishableChannel[];
  threads: PublishableChannelContent;
  shortform: PublishableChannelContent;
  naver_blog?: PublishableChannelContent;
  naver_band?: PublishableChannelContent;
  kakao_channel?: PublishableChannelContent;
  /** Bundle-level pointer to approved Canonical Asset used for generation. */
  sourceAssetId?: string | null;
  sourceAssetVersion?: number | null;
  sourceAssetRevision?: string | null;
};

export function isPublishableChannel(value: unknown): value is PublishableChannel {
  return (
    typeof value === "string" &&
    (PUBLISHABLE_CHANNELS as readonly string[]).includes(value)
  );
}

export function formatForChannel(channel: PublishableChannel): PublishableFormat {
  switch (channel) {
    case "threads":
      return "threads_text";
    case "shortform":
      return "short_video_narration";
    case "naver_blog":
      return "naver_blog_article";
    case "naver_band":
      return "naver_band_post";
    case "kakao_channel":
      return "kakao_channel_post";
  }
}
