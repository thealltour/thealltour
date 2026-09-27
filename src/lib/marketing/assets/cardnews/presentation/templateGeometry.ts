/**
 * Deterministic template geometry for 1080×1350 (4:5) primary.
 * LLM never emits free coordinates — only template + bounded ratios/enums.
 */

import {
  CARDNEWS_BRAND,
  CARDNEWS_SAFE,
  type CardNewsGeometry,
} from "@/lib/marketing/assets/cardnews/brand";
import type {
  CardCropMode,
  CardFocalAlignment,
  CardOverlayMode,
  CardPresentation,
  CardPresentationTemplate,
  CardTextDensity,
  CardTextPlacement,
} from "@/lib/marketing/assets/cardnews/presentation/contracts";
import {
  preferredBodyPx,
  preferredHeadlinePx,
  TYPOGRAPHY_BODY_FILL_PAPER,
} from "@/lib/marketing/assets/cardnews/typographyTokens";
import {
  OVERLAY_TEXT_INSETS,
  PAPER_TEXT_INSETS,
  overlayTextMaxWidth,
  paperTextMaxWidth,
} from "@/lib/marketing/assets/cardnews/overlayTextInsets";

export type ImageBandGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
  rx: number;
};

export type TextBandGeometry = {
  x: number;
  y: number;
  width: number;
  maxHeadlineHeight: number;
  maxBodyHeight: number;
  kickerY: number;
  headlinePreferred: number;
  bodyPreferred: number;
  fill: string;
  headlineFill: string;
  bodyFill: string;
  kickerFill: string;
};

export type BrandPlacement = {
  wordmark: { x: number; y: number; width: number; height: number; opacity: number };
  progressY: number;
  showTopBar: boolean;
  showBottomAccent: boolean;
  /** v2.6 closing: hairline above brand wordmark (signature, not CTA). */
  signatureRule?: { x: number; y: number; width: number; height: number };
  /** v2.6 closing: small dual-bar editorial accent (no copy). */
  showEditorialAccent?: boolean;
  editorialAccentY?: number;
};

export type ResolvedTemplateLayout = {
  template: CardPresentationTemplate;
  image: ImageBandGeometry | null;
  text: TextBandGeometry;
  overlay: {
    mode: CardOverlayMode;
    y: number;
    height: number;
  } | null;
  brand: BrandPlacement;
  cropMode: CardCropMode;
  focalAlignment: CardFocalAlignment;
  preserveAspectRatio: string;
  textDensity: CardTextDensity;
  textPlacement: CardTextPlacement;
  /** v2.3 content-aware diagnostics (optional). */
  contentAware?: {
    imageTextGap?: number;
    textBandTop?: number;
    textBlockHeight: number;
    footerSafeY: number;
    preferredImageRatio?: number;
    actualImageRatio?: number;
    remainingBelowText: number;
    internalDeadZone?: number;
  };
};

const H_MARGIN = PAPER_TEXT_INSETS.left;
const V_MARGIN = 88;

/** SVG <text y> is baseline — glyph box extends above/below. */
const ASCENT_RATIO = 0.82;
const DESCENT_RATIO = 0.22;
const KICKER_FONT_PX = 20;
/** Clear air between kicker glyph bottom and headline glyph top (non-cover). */
export const MIN_KICKER_HEADLINE_CLEAR_PX = 32;
/**
 * Image bottom → text-band start preferred gap (legacy constant).
 * Prefer {@link IMAGE_TEXT_GAP} from contentAwareLayout for v2.3 allocation.
 */
export const MIN_IMAGE_TEXT_BAND_GAP_PX = 64;

function densityHeadline(density: CardTextDensity, cover: boolean, statement: boolean): number {
  if (statement) return preferredHeadlinePx(density, "statement");
  if (cover) return preferredHeadlinePx(density, "cover");
  return preferredHeadlinePx(density, "story");
}

function densityBody(density: CardTextDensity, cover = false, statement = false): number {
  if (statement) return preferredBodyPx(density, "statement");
  if (cover) return preferredBodyPx(density, "cover");
  return preferredBodyPx(density, "story");
}

export function densityHeadlinePx(
  density: CardTextDensity,
  cover: boolean,
  statement: boolean,
): number {
  return densityHeadline(density, cover, statement);
}

export function densityBodyPx(
  density: CardTextDensity,
  cover = false,
  statement = false,
): number {
  return densityBody(density, cover, statement);
}

export function estimateGlyphTop(baselineY: number, fontPx: number): number {
  return baselineY - Math.round(fontPx * ASCENT_RATIO);
}

export function estimateGlyphBottom(baselineY: number, fontPx: number): number {
  return baselineY + Math.round(fontPx * DESCENT_RATIO);
}

/** Headline baseline so glyph boxes never overlap and clear ≥ MIN_KICKER_HEADLINE_CLEAR_PX. */
export function headlineBaselineAfterKicker(input: {
  kickerBaselineY: number;
  headlineFontPx: number;
  kickerFontPx?: number;
  clearPx?: number;
}): number {
  const kickerFont = input.kickerFontPx ?? KICKER_FONT_PX;
  const clear = input.clearPx ?? MIN_KICKER_HEADLINE_CLEAR_PX;
  const kickerBottom = estimateGlyphBottom(input.kickerBaselineY, kickerFont);
  const ascent = Math.round(input.headlineFontPx * ASCENT_RATIO);
  return kickerBottom + clear + ascent;
}

/** Kicker baseline so its glyph top sits at `bandTopY`. */
export function kickerBaselineAtBandTop(bandTopY: number, kickerFontPx = KICKER_FONT_PX): number {
  return bandTopY + Math.round(kickerFontPx * ASCENT_RATIO);
}

/** Headline baseline so its glyph top sits at `bandTopY` (no kicker). */
export function headlineBaselineAtBandTop(bandTopY: number, headlineFontPx: number): number {
  return bandTopY + Math.round(headlineFontPx * ASCENT_RATIO);
}

/**
 * Text-band anchors. When there is no explicit editorial kicker, headline
 * starts at bandTop (no reserved empty kicker slot).
 */
export function resolveTextBandAnchors(input: {
  bandTopY: number;
  headlineFontPx: number;
  hasKicker: boolean;
}): { kickerY: number; headlineY: number } {
  if (!input.hasKicker) {
    const headlineY = headlineBaselineAtBandTop(input.bandTopY, input.headlineFontPx);
    return { kickerY: headlineY, headlineY };
  }
  const kickerY = kickerBaselineAtBandTop(input.bandTopY);
  const headlineY = headlineBaselineAfterKicker({
    kickerBaselineY: kickerY,
    headlineFontPx: input.headlineFontPx,
  });
  return { kickerY, headlineY };
}

/** Map focalAlignment → SVG preserveAspectRatio (meet|slice from cropMode). */
export function focalToPreserveAspectRatio(
  focal: CardFocalAlignment,
  cropMode: CardCropMode,
): string {
  const fit = cropMode === "contain" ? "meet" : "slice";
  const map: Record<CardFocalAlignment, string> = {
    center: `xMidYMid ${fit}`,
    top: `xMidYMin ${fit}`,
    bottom: `xMidYMax ${fit}`,
    left: `xMinYMid ${fit}`,
    right: `xMaxYMid ${fit}`,
    "top-left": `xMinYMin ${fit}`,
    "top-right": `xMaxYMin ${fit}`,
    "bottom-left": `xMinYMax ${fit}`,
    "bottom-right": `xMaxYMax ${fit}`,
  };
  return map[focal] ?? `xMidYMid ${fit}`;
}

function clampRatio(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Resolve presentation → pixel geometry on the target canvas.
 * Primary DoD is 4:5; other ratios use scaleY for vertical anchors.
 */
export function resolveTemplateLayout(input: {
  presentation: CardPresentation;
  geometry: CardNewsGeometry;
  hasVisual: boolean;
  roleHint?: string;
  /** When false (default), do not reserve vertical space for a kicker label. */
  hasKicker?: boolean;
}): ResolvedTemplateLayout {
  const geo = input.geometry;
  const p = input.presentation;
  const density = p.textDensity;
  const cropMode = p.cropMode ?? "cover";
  const focal = p.focalAlignment ?? "center";
  const preserveAspectRatio = focalToPreserveAspectRatio(focal, cropMode);
  const overlayMode = p.overlayMode ?? "none";
  const hasKicker = Boolean(input.hasKicker);

  const paperTextWidth = paperTextMaxWidth(geo.width);
  const overlayWidth = overlayTextMaxWidth(geo.width);
  const ink = CARDNEWS_BRAND.ink;
  const white = CARDNEWS_BRAND.white;

  const brandSubtle = (opacity: number): BrandPlacement => ({
    wordmark: {
      x: H_MARGIN,
      y: geo.height - geo.scaleY(72),
      width: 200,
      height: 36,
      opacity,
    },
    progressY: geo.height - geo.scaleY(96),
    showTopBar: false,
    showBottomAccent: false,
  });

  const brandSignatureClosing = (): BrandPlacement => ({
    wordmark: {
      x: H_MARGIN,
      y: geo.height - geo.scaleY(156),
      width: 340,
      height: 58,
      opacity: 0.95,
    },
    progressY: geo.height - geo.scaleY(48),
    showTopBar: true,
    showBottomAccent: true,
    signatureRule: {
      x: H_MARGIN,
      y: geo.height - geo.scaleY(186),
      width: 112,
      height: 2,
    },
    showEditorialAccent: true,
    editorialAccentY: geo.scaleY(72),
  });

  // No visual → force text/closing family (clarity-first vertical rhythm)
  if (!input.hasVisual || p.template === "text_statement" || p.template === "closing_insight") {
    const isClosing = p.template === "closing_insight";
    const headlinePreferred = densityHeadline(density, false, !isClosing);
    const bodyPreferred = densityBody(density, false, !isClosing);
    const preferredHeadline = isClosing
      ? Math.max(headlinePreferred, 64)
      : Math.max(headlinePreferred, 72);
    // Without kicker, start higher so we do not leave a dead empty slot.
    const bandTop = geo.scaleY(
      hasKicker ? (isClosing ? 340 : 340) : isClosing ? 220 : 220,
    );
    const { kickerY, headlineY } = resolveTextBandAnchors({
      bandTopY: bandTop,
      headlineFontPx: preferredHeadline,
      hasKicker,
    });
    return {
      template: isClosing ? "closing_insight" : "text_statement",
      image: null,
      text: {
        x: H_MARGIN,
        y: headlineY,
        width: paperTextWidth,
        maxHeadlineHeight: geo.scaleY(isClosing ? 300 : 380),
        maxBodyHeight: geo.scaleY(isClosing ? 200 : 240),
        kickerY,
        headlinePreferred: preferredHeadline,
        bodyPreferred,
        fill: CARDNEWS_BRAND.paper,
        headlineFill: ink,
        bodyFill: TYPOGRAPHY_BODY_FILL_PAPER,
        kickerFill: isClosing ? CARDNEWS_BRAND.orange : CARDNEWS_BRAND.blue,
      },
      overlay: null,
      brand: isClosing ? brandSignatureClosing() : { ...brandSubtle(0.4), showTopBar: true, showBottomAccent: false },
      cropMode,
      focalAlignment: focal,
      preserveAspectRatio,
      textDensity: density,
      textPlacement: p.textPlacement,
    };
  }

  switch (p.template) {
    case "cover_full_bleed": {
      const headlinePreferred = densityHeadline(density, true, false);
      const bodyPreferred = densityBody(density, true, false);
      const textBlockH = geo.scaleY(hasKicker ? 380 : 340);
      const bandTop = geo.height - textBlockH + geo.scaleY(hasKicker ? 28 : 40);
      const { kickerY, headlineY } = resolveTextBandAnchors({
        bandTopY: bandTop,
        headlineFontPx: headlinePreferred,
        hasKicker,
      });
      return {
        template: "cover_full_bleed",
        image: { x: 0, y: 0, width: geo.width, height: geo.height, rx: 0 },
        text: {
          x: OVERLAY_TEXT_INSETS.left,
          y: headlineY,
          width: overlayWidth,
          maxHeadlineHeight: geo.scaleY(200),
          maxBodyHeight: geo.scaleY(200),
          kickerY,
          headlinePreferred,
          bodyPreferred,
          fill: "transparent",
          headlineFill: white,
          bodyFill: "rgba(255,255,255,0.92)",
          kickerFill: "rgba(255,255,255,0.75)",
        },
        overlay: {
          mode: overlayMode === "none" ? "gradient_dark" : overlayMode,
          y: geo.height - textBlockH - geo.scaleY(40),
          height: textBlockH + geo.scaleY(40),
        },
        brand: {
          wordmark: {
            x: OVERLAY_TEXT_INSETS.left,
            y: geo.scaleY(48),
            width: 160,
            height: 30,
            opacity: 0.55,
          },
          progressY: geo.height - geo.scaleY(40),
          showTopBar: false,
          showBottomAccent: false,
        },
        cropMode,
        focalAlignment: focal,
        preserveAspectRatio,
        textDensity: density,
        textPlacement: "overlay-bottom",
      };
    }
    case "photo_bottom_story": {
      const ratio = clampRatio(p.imageHeightRatio, 0.52, 0.42, 0.62);
      const imageH = Math.round(geo.height * ratio);
      const imageY = geo.height - imageH;
      const headlinePreferred = densityHeadline(density, false, false);
      const bandTop = geo.scaleY(hasKicker ? 100 : 88);
      const { kickerY, headlineY } = resolveTextBandAnchors({
        bandTopY: bandTop,
        headlineFontPx: headlinePreferred,
        hasKicker,
      });
      return {
        template: "photo_bottom_story",
        image: { x: 0, y: imageY, width: geo.width, height: imageH, rx: 0 },
        text: {
          x: H_MARGIN,
          y: headlineY,
          width: paperTextWidth,
          maxHeadlineHeight: geo.scaleY(200),
          maxBodyHeight: Math.max(80, imageY - headlineY - geo.scaleY(120)),
          kickerY,
          headlinePreferred,
          bodyPreferred: densityBody(density),
          fill: CARDNEWS_BRAND.paper,
          headlineFill: ink,
          bodyFill: TYPOGRAPHY_BODY_FILL_PAPER,
          kickerFill: CARDNEWS_BRAND.blue,
        },
        overlay: null,
        brand: brandSubtle(0.4),
        cropMode,
        focalAlignment: focal,
        preserveAspectRatio,
        textDensity: density,
        textPlacement: "top",
      };
    }
    case "photo_overlay_editorial": {
      // Full-bleed overlay family — same canvas image as cover; shared body scale.
      const headlinePreferred = densityHeadline(density, false, false);
      const bodyPreferred = densityBody(density, false, false);
      const bandH = geo.scaleY(hasKicker ? 420 : 380);
      const bandTop = geo.height - bandH + geo.scaleY(hasKicker ? 16 : 28);
      const { kickerY, headlineY } = resolveTextBandAnchors({
        bandTopY: bandTop,
        headlineFontPx: headlinePreferred,
        hasKicker,
      });
      return {
        template: "photo_overlay_editorial",
        image: { x: 0, y: 0, width: geo.width, height: geo.height, rx: 0 },
        text: {
          x: OVERLAY_TEXT_INSETS.left,
          y: headlineY,
          width: overlayWidth,
          maxHeadlineHeight: geo.scaleY(220),
          maxBodyHeight: geo.scaleY(280),
          kickerY,
          headlinePreferred,
          bodyPreferred,
          fill: "transparent",
          headlineFill: white,
          bodyFill: "rgba(255,255,255,0.92)",
          kickerFill: "rgba(255,255,255,0.75)",
        },
        overlay: {
          mode: overlayMode === "none" ? "gradient_dark" : overlayMode,
          y: geo.height - bandH - geo.scaleY(80),
          height: bandH + geo.scaleY(80),
        },
        brand: {
          wordmark: {
            x: OVERLAY_TEXT_INSETS.left,
            y: geo.scaleY(48),
            width: 160,
            height: 30,
            opacity: 0.5,
          },
          progressY: geo.height - geo.scaleY(40),
          showTopBar: false,
          showBottomAccent: false,
        },
        cropMode,
        focalAlignment: focal,
        preserveAspectRatio,
        textDensity: density,
        textPlacement: p.textPlacement,
      };
    }
    case "evidence_detail": {
      const ratio = clampRatio(p.imageHeightRatio, 0.5, 0.44, 0.58);
      const imageH = Math.round(geo.height * ratio);
      const inset = 48;
      const imageTop = geo.scaleY(80);
      const imageBottom = imageTop + imageH;
      const headlinePreferred = densityHeadline("compact", false, false);
      const bandTop = imageBottom + geo.scaleY(MIN_IMAGE_TEXT_BAND_GAP_PX);
      const { kickerY, headlineY } = resolveTextBandAnchors({
        bandTopY: bandTop,
        headlineFontPx: headlinePreferred,
        hasKicker,
      });
      return {
        template: "evidence_detail",
        image: {
          x: inset,
          y: imageTop,
          width: geo.width - inset * 2,
          height: imageH,
          rx: 12,
        },
        text: {
          x: H_MARGIN,
          y: headlineY,
          width: paperTextWidth,
          maxHeadlineHeight: geo.scaleY(140),
          maxBodyHeight: Math.max(80, geo.height - headlineY - geo.scaleY(180)),
          kickerY,
          headlinePreferred,
          bodyPreferred: densityBody("compact"),
          fill: CARDNEWS_BRAND.paper,
          headlineFill: ink,
          bodyFill: TYPOGRAPHY_BODY_FILL_PAPER,
          kickerFill: CARDNEWS_BRAND.blue,
        },
        overlay: null,
        brand: brandSubtle(0.35),
        cropMode,
        focalAlignment: focal,
        preserveAspectRatio,
        textDensity: density,
        textPlacement: "bottom",
      };
    }
    case "photo_top_story":
    default: {
      const ratio = clampRatio(p.imageHeightRatio, 0.48, 0.42, 0.56);
      const imageH = Math.round(geo.height * ratio);
      const headlinePreferred = densityHeadline(density, false, false);
      const bandTop = imageH + geo.scaleY(MIN_IMAGE_TEXT_BAND_GAP_PX);
      const { kickerY, headlineY } = resolveTextBandAnchors({
        bandTopY: bandTop,
        headlineFontPx: headlinePreferred,
        hasKicker,
      });
      return {
        template: "photo_top_story",
        image: { x: 0, y: 0, width: geo.width, height: imageH, rx: 0 },
        text: {
          x: H_MARGIN,
          y: headlineY,
          width: paperTextWidth,
          maxHeadlineHeight: geo.scaleY(200),
          maxBodyHeight: Math.max(80, geo.height - headlineY - geo.scaleY(200)),
          kickerY,
          headlinePreferred,
          bodyPreferred: densityBody(density),
          fill: CARDNEWS_BRAND.paper,
          headlineFill: ink,
          bodyFill: TYPOGRAPHY_BODY_FILL_PAPER,
          kickerFill: CARDNEWS_BRAND.blue,
        },
        overlay: null,
        brand: brandSubtle(0.4),
        cropMode,
        focalAlignment: focal,
        preserveAspectRatio,
        textDensity: density,
        textPlacement: "bottom",
      };
    }
  }
}

/** Soft check: image area coverage vs canvas (for regression tests). */
export function imageCoverageRatio(layout: ResolvedTemplateLayout, geometry: CardNewsGeometry): number {
  if (!layout.image) return 0;
  return (layout.image.width * layout.image.height) / (geometry.width * geometry.height);
}

export const PRESENTATION_SAFE_MARGINS = {
  horizontal: H_MARGIN,
  overlayLeft: OVERLAY_TEXT_INSETS.left,
  overlayRight: OVERLAY_TEXT_INSETS.right,
  vertical: V_MARGIN,
  legacyPadX: CARDNEWS_SAFE.padX,
} as const;
