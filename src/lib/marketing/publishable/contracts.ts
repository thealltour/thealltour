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
] as const;
export type PublishableContentStatus = (typeof PUBLISHABLE_CONTENT_STATUSES)[number];

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
  };
  validation: PublishableValidationResult;
  /** Shortform only — spoken segments for ShortVideoBrief. */
  narrationSegments?: PublishableNarrationSegment[];
  /** Naver Blog structured fields (optional). */
  blogMeta?: PublishableBlogMeta;
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
