/**
 * CG-4A — Publishable channel content contracts.
 * Internal planning (contentPlan/outline) stays separate from channel-ready copy.
 */

export const PUBLISHABLE_CONTENT_BUNDLE_CONTRACT = "publishable-channel-content-bundle-v1" as const;
export const PUBLISHABLE_CHANNEL_CONTENT_CONTRACT = "publishable-channel-content-v1" as const;

export const PUBLISHABLE_CHANNELS = ["threads", "shortform"] as const;
export type PublishableChannel = (typeof PUBLISHABLE_CHANNELS)[number];

export const PUBLISHABLE_FORMATS = ["threads_text", "short_video_narration"] as const;
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
  | "template_slop";

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
  provenance: {
    composer: "llm" | "deterministic_fallback" | "human";
    evidenceRefIds: string[];
    commercialIntent: string | null;
  };
  validation: PublishableValidationResult;
  /** Shortform only — spoken segments for ShortVideoBrief. */
  narrationSegments?: PublishableNarrationSegment[];
};

export type PublishableContentBundle = {
  contract: typeof PUBLISHABLE_CONTENT_BUNDLE_CONTRACT;
  candidateId: string;
  businessDateKst: string;
  generatedAt: string;
  sourceRevision: string;
  threads: PublishableChannelContent;
  shortform: PublishableChannelContent;
};
