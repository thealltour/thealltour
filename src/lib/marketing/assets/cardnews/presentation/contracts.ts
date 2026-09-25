/**
 * Card Presentation Plan — Layout Director decisions only.
 * Bounded enums; no free-form geometry coordinates from LLM.
 */

export const CARD_PRESENTATION_PLAN_CONTRACT = "card-presentation-plan-v1" as const;
export const CARD_LAYOUT_DIRECTOR_HERMES_PROFILE = "card-layout-director" as const;

export const CARD_PRESENTATION_TEMPLATES = [
  "cover_full_bleed",
  "photo_top_story",
  "photo_bottom_story",
  "photo_overlay_editorial",
  "evidence_detail",
  "text_statement",
  "closing_insight",
] as const;

export type CardPresentationTemplate = (typeof CARD_PRESENTATION_TEMPLATES)[number];

export const CARD_IMAGE_PLACEMENTS = ["full", "top", "bottom"] as const;
export type CardImagePlacement = (typeof CARD_IMAGE_PLACEMENTS)[number];

export const CARD_CROP_MODES = ["cover", "contain"] as const;
export type CardCropMode = (typeof CARD_CROP_MODES)[number];

export const CARD_FOCAL_ALIGNMENTS = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;

export type CardFocalAlignment = (typeof CARD_FOCAL_ALIGNMENTS)[number];

export const CARD_TEXT_PLACEMENTS = [
  "top",
  "bottom",
  "overlay-top",
  "overlay-bottom",
] as const;

export type CardTextPlacement = (typeof CARD_TEXT_PLACEMENTS)[number];

export const CARD_OVERLAY_MODES = ["none", "gradient_dark", "gradient_light"] as const;
export type CardOverlayMode = (typeof CARD_OVERLAY_MODES)[number];

export const CARD_TEXT_DENSITIES = ["minimal", "compact", "standard"] as const;
export type CardTextDensity = (typeof CARD_TEXT_DENSITIES)[number];

export type CardPresentation = {
  cardId: string;
  template: CardPresentationTemplate;
  visualId?: string | null;
  /**
   * Declared image band placement (full/top/bottom).
   * DEBT: cardnews-render-v2.2 does not consume this field — template selection
   * is the image-placement authority. Kept for plan contract compatibility.
   */
  imagePlacement?: CardImagePlacement;
  /** 0–1 of canvas height occupied by image band (when not full). */
  imageHeightRatio?: number;
  cropMode?: CardCropMode;
  focalAlignment?: CardFocalAlignment;
  textPlacement: CardTextPlacement;
  overlayMode?: CardOverlayMode;
  textDensity: CardTextDensity;
};

export type CardPresentationPlanProvenance = {
  sourceAssetId: string;
  sourceVersion: number;
  sourceInstagramFingerprint: string;
  sourceVisualPlanFingerprint?: string | null;
  modelProfile: string;
  generatedAt: string;
};

export type CardPresentationPlan = {
  contract: typeof CARD_PRESENTATION_PLAN_CONTRACT;
  assetId: string;
  assetVersion: number;
  cards: CardPresentation[];
  provenance: CardPresentationPlanProvenance;
};

export const CARD_PRESENTATION_PLAN_RELATIVE_PATH =
  "context/card-presentation-plan.json" as const;
export const CARD_PRESENTATION_PLAN_MEDIA_TYPE = "application/json" as const;

/** Templates that require a visual surface. */
export const VISUAL_REQUIRED_TEMPLATES: ReadonlySet<CardPresentationTemplate> = new Set([
  "cover_full_bleed",
  "photo_top_story",
  "photo_bottom_story",
  "photo_overlay_editorial",
  "evidence_detail",
]);
