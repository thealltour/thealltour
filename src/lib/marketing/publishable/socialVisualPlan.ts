/**
 * Stable social visual IDs for Threads mediaPlan + Instagram card planning.
 * Used later for Manual Astra handoff → operator upload → hermes-pi matching.
 * No image generation or upload mapping in this module.
 */

export const SOCIAL_VISUAL_ASSET_FAMILY = "social_static" as const;

export const SOCIAL_VISUAL_ROLES = [
  "cover_context",
  "subject_detail",
  "evidence_context",
  "cultural_detail",
  "architecture_detail",
  "simple_comparison",
] as const;

export type SocialVisualRole = (typeof SOCIAL_VISUAL_ROLES)[number];

export const INSTAGRAM_VISUAL_MODES = [
  "typography",
  "editorial_photo",
  "object_or_detail",
  "icon_infographic",
  "contrast_diagram",
  "map_context",
  "fact_card",
  "evidence_boundary",
  "minimal_closing",
] as const;

export type InstagramVisualMode = (typeof INSTAGRAM_VISUAL_MODES)[number];

/** Deterministic shared ID: social_visual_01 … social_visual_NN */
export function stableSocialVisualId(index1Based: number): string {
  const n = Math.max(1, Math.floor(index1Based));
  return `social_visual_${String(n).padStart(2, "0")}`;
}

export function isStableSocialVisualId(id: string): boolean {
  return /^social_visual_\d{2,}$/.test(id.trim());
}

export type ThreadsMediaPlanVisual = {
  visualId: string;
  role: string;
  visualIntent: string;
  reusableOnInstagram: boolean;
};

export type ThreadsMediaPlan = {
  recommended: boolean;
  assetFamily: typeof SOCIAL_VISUAL_ASSET_FAMILY;
  /** 0–3; media is optional */
  imageCount: number;
  visuals: ThreadsMediaPlanVisual[];
};

export type InstagramCardVisualPlan = {
  visualId: string;
  visualMode: InstagramVisualMode | string;
  generatedVisualNeeded: boolean;
  reusableOnThreads: boolean;
  visualIntent: string;
};

export type InstagramCardPlanItem = {
  cardId: string;
  role: "cover" | "information" | "evidence" | "cta";
  headline: string;
  body: string;
  visualIntent: string;
  evidenceRefs?: string[];
  visual?: InstagramCardVisualPlan;
};
