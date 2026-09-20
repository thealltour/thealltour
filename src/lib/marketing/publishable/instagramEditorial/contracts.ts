/**
 * Instagram Editorial Split — carousel / card-copy / caption contracts.
 * Visual planning authority stays with Shared Visual Planner (visualPriority only).
 */

export const INSTAGRAM_CAROUSEL_PLAN_CONTRACT = "instagram-carousel-plan-v1" as const;
export const INSTAGRAM_CARD_COPY_CONTRACT = "instagram-card-copy-v1" as const;
export const INSTAGRAM_CAPTION_CONTRACT = "instagram-caption-v1" as const;

export const INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE = "instagram-carousel-planner" as const;
export const INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE = "instagram-card-copy-writer" as const;
export const INSTAGRAM_CAPTION_WRITER_HERMES_PROFILE = "instagram-caption-writer" as const;

export const INSTAGRAM_EDITORIAL_HERMES_PROFILES = {
  carouselPlanner: INSTAGRAM_CAROUSEL_PLANNER_HERMES_PROFILE,
  cardCopyWriter: INSTAGRAM_CARD_COPY_WRITER_HERMES_PROFILE,
  captionWriter: INSTAGRAM_CAPTION_WRITER_HERMES_PROFILE,
} as const;

export const INSTAGRAM_CAROUSEL_ROLES = [
  "hook_cover",
  "reframe",
  "context",
  "evidence",
  "evidence_detail",
  "contrast",
  "closing",
  "cta",
] as const;

export type InstagramCarouselRole = (typeof INSTAGRAM_CAROUSEL_ROLES)[number];

export const INSTAGRAM_VISUAL_PRIORITIES = [
  "hero",
  "strong",
  "useful",
  "optional",
  "none",
] as const;

export type InstagramVisualPriority = (typeof INSTAGRAM_VISUAL_PRIORITIES)[number];

export type InstagramEditorialProvenance = {
  sourceAssetId: string;
  sourceVersion: number;
  modelProfile: string;
  generatedAt: string;
  /** Upstream artifact fingerprint (narrative / carousel / card-copy). */
  sourceUpstreamFingerprint: string;
};

export type InstagramCarouselCardPlan = {
  cardId: string;
  role: InstagramCarouselRole;
  beatIds: string[];
  communicationGoal: string;
  visualPriority: InstagramVisualPriority;
};

export type InstagramCarouselPlan = {
  contract: typeof INSTAGRAM_CAROUSEL_PLAN_CONTRACT;
  assetId: string;
  assetVersion: number;
  cards: InstagramCarouselCardPlan[];
  sourceNarrativeFingerprint: string;
  provenance: InstagramEditorialProvenance;
};

export type InstagramCardCopyItem = {
  cardId: string;
  kicker?: string;
  headline: string;
  body?: string;
  microcopy?: string;
  evidenceRefs?: string[];
};

export type InstagramCardCopy = {
  contract: typeof INSTAGRAM_CARD_COPY_CONTRACT;
  assetId: string;
  assetVersion: number;
  cards: InstagramCardCopyItem[];
  sourceCarouselFingerprint: string;
  provenance: InstagramEditorialProvenance;
};

export type InstagramCaption = {
  contract: typeof INSTAGRAM_CAPTION_CONTRACT;
  assetId: string;
  assetVersion: number;
  opening: string;
  body: string;
  cta?: string | null;
  hashtags: string[];
  altText: string;
  sourceCardCopyFingerprint: string;
  provenance: InstagramEditorialProvenance;
};
