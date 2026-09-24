/**
 * Instagram Visual Role Architect — per-card visual semantics / rhythm.
 * Final master orchestration remains Shared Visual Planner.
 */

export const INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT = "instagram-visual-role-plan-v1" as const;
export const INSTAGRAM_VISUAL_ROLE_ARCHITECT_HERMES_PROFILE =
  "instagram-visual-role-architect" as const;

export const INSTAGRAM_VISUAL_ROLES = [
  "hero_cover",
  "bridge_statement",
  "supporting_context",
  "cultural_context",
  "evidence_detail",
  "architecture_detail",
  "atmosphere",
  "closing_mood",
  "typography_anchor",
] as const;

export type InstagramVisualRole = (typeof INSTAGRAM_VISUAL_ROLES)[number];

export const INSTAGRAM_VISUAL_DENSITIES = [
  "dominant",
  "strong",
  "balanced",
  "subtle",
] as const;

export type InstagramVisualDensity = (typeof INSTAGRAM_VISUAL_DENSITIES)[number];

export const INSTAGRAM_VISUAL_GENERATION_PREFERENCES = [
  "required",
  "preferred",
  "optional",
  "none",
] as const;

export type InstagramVisualGenerationPreference =
  (typeof INSTAGRAM_VISUAL_GENERATION_PREFERENCES)[number];

export const INSTAGRAM_VISUAL_REUSE_PREFERENCES = [
  "exclusive_preferred",
  "reusable",
  "derivative_ok",
] as const;

export type InstagramVisualReusePreference =
  (typeof INSTAGRAM_VISUAL_REUSE_PREFERENCES)[number];

export const INSTAGRAM_VISUAL_PRESENTATION_PREFERENCES = [
  "full_bleed",
  "image_backed_statement",
  "photo_top",
  "photo_bottom",
  "overlay",
  "detail_focus",
  "background_mood",
] as const;

export type InstagramVisualPresentationPreference =
  (typeof INSTAGRAM_VISUAL_PRESENTATION_PREFERENCES)[number];

/** Soft preference for SVP — not final visualMode. */
export const INSTAGRAM_VISUAL_MODE_PREFERENCES = [
  "editorial_photo",
  "object_or_detail",
  "icon_infographic",
  "contrast_diagram",
  "map_context",
  "fact_card",
  "evidence_boundary",
  "minimal_closing",
  "typography",
  "atmosphere",
] as const;

export type InstagramVisualModePreference =
  (typeof INSTAGRAM_VISUAL_MODE_PREFERENCES)[number];

export type InstagramVisualRoleProvenance = {
  sourceAssetId: string;
  sourceVersion: number;
  modelProfile: string;
  generatedAt: string;
  sourceCarouselFingerprint: string;
  sourceCardCopyFingerprint: string;
};

export type InstagramVisualRoleCard = {
  cardId: string;
  visualRole: InstagramVisualRole;
  visualPurpose: string;
  visualPriority: "hero" | "strong" | "useful" | "optional" | "none";
  visualDensity: InstagramVisualDensity;
  visualModePreference: InstagramVisualModePreference;
  generationPreference: InstagramVisualGenerationPreference;
  presentationPreference: InstagramVisualPresentationPreference;
  reusePreference: InstagramVisualReusePreference;
  concreteVisualIntent: string;
  evidenceRefs: string[];
};

export type InstagramVisualRolePlan = {
  contract: typeof INSTAGRAM_VISUAL_ROLE_PLAN_CONTRACT;
  assetId: string;
  assetVersion: number;
  sourceCarouselFingerprint: string;
  sourceCardCopyFingerprint: string;
  cards: InstagramVisualRoleCard[];
  rhythmSummary: string;
  provenance: InstagramVisualRoleProvenance;
};
