export type {
  CardPresentation,
  CardPresentationPlan,
  CardPresentationTemplate,
  CardFocalAlignment,
  CardCropMode,
} from "@/lib/marketing/assets/cardnews/presentation/contracts";

export {
  CARD_PRESENTATION_PLAN_CONTRACT,
  CARD_LAYOUT_DIRECTOR_HERMES_PROFILE,
  CARD_PRESENTATION_TEMPLATES,
  CARD_PRESENTATION_PLAN_RELATIVE_PATH,
  VISUAL_REQUIRED_TEMPLATES,
} from "@/lib/marketing/assets/cardnews/presentation/contracts";

export {
  buildDeterministicCardPresentationPlan,
  assertCardPresentationArtifactContractParity,
  legacyRoleToPresentationHint,
} from "@/lib/marketing/assets/cardnews/presentation/deterministic";

export {
  materializeCardPresentationPlan,
  CardPresentationMaterializeError,
} from "@/lib/marketing/assets/cardnews/presentation/materialize";

export {
  resolveTemplateLayout,
  focalToPreserveAspectRatio,
  imageCoverageRatio,
  estimateGlyphTop,
  estimateGlyphBottom,
  headlineBaselineAfterKicker,
  headlineBaselineAtBandTop,
  kickerBaselineAtBandTop,
  resolveTextBandAnchors,
  densityHeadlineBodyGapPx,
  footerSafeTextBottom,
  progressYForGeometry,
  normalizeBandTextPlacement,
  placeMeasuredBlockInBand,
  MIN_KICKER_HEADLINE_CLEAR_PX,
  MIN_IMAGE_TEXT_BAND_GAP_PX,
} from "@/lib/marketing/assets/cardnews/presentation/templateGeometry";

export {
  buildResolvedCardRenderSpec,
  applyMeasuredTextPlacement,
  normalizeExplicitEditorialKicker,
} from "@/lib/marketing/assets/cardnews/presentation/resolveRenderSpec";
export type { ResolvedCardRenderSpec } from "@/lib/marketing/assets/cardnews/presentation/resolveRenderSpec";

export {
  persistCardPresentationPlan,
  readCardPresentationPlanFromPackage,
} from "@/lib/marketing/assets/cardnews/presentation/persist";

export {
  buildInstagramPresentationSourceFingerprint,
  buildCardPresentationContentFingerprint,
  resolveCardPresentationLifecycle,
} from "@/lib/marketing/assets/cardnews/presentation/fingerprint";

export { ensureCardLayoutDirectorHermesReady } from "@/lib/marketing/assets/cardnews/presentation/hermesIdentity";
