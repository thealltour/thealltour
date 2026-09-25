/**
 * Content-aware vertical allocation (cardnews-render-v2.3).
 *
 * Order: platform safe → footer reserve → measured text → aesthetic gap → image absorbs remainder
 * (within min/preferred/max). imageHeightRatio is a preferred visual-weight hint, not absolute authority.
 */

import type { CardNewsGeometry } from "@/lib/marketing/assets/cardnews/brand";
import type { CardPresentationTemplate, CardTextDensity } from "@/lib/marketing/assets/cardnews/presentation/contracts";
import {
  resolvePlatformLayout,
  type InstagramPlatformLayout,
} from "@/lib/marketing/assets/cardnews/presentation/platformLayout";
import {
  resolveTextBandAnchors,
  type ImageBandGeometry,
} from "@/lib/marketing/assets/cardnews/presentation/templateGeometry";

/** Image↔text gap range (4:5 base px; scale via geometry.scaleY). */
export const IMAGE_TEXT_GAP = {
  min: 40,
  preferred: 64,
  max: 96,
} as const;

/** Headline↔body gap by density (4:5 base px). */
export const HEADLINE_BODY_GAP: Record<CardTextDensity, number> = {
  compact: 28,
  standard: 36,
  minimal: 40,
};

export type ImageRatioBounds = {
  min: number;
  preferred: number;
  max: number;
};

export function imageRatioBoundsForTemplate(
  template: CardPresentationTemplate,
  planPreferred: number | undefined,
): ImageRatioBounds | null {
  switch (template) {
    case "photo_top_story":
      return {
        min: 0.4,
        preferred: clamp(planPreferred ?? 0.48, 0.4, 0.68),
        max: 0.68,
      };
    case "evidence_detail":
      return {
        min: 0.42,
        preferred: clamp(planPreferred ?? 0.5, 0.42, 0.6),
        max: 0.6,
      };
    case "photo_bottom_story":
      return {
        min: 0.42,
        preferred: clamp(planPreferred ?? 0.52, 0.42, 0.62),
        max: 0.62,
      };
    default:
      return null;
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export type ContentAwareBandMetrics = {
  imageTop: number;
  imageBottom: number;
  imageHeight: number;
  actualImageRatio: number;
  preferredImageRatio: number;
  imageTextGap: number;
  textBandTop: number;
  textBlockHeight: number;
  footerSafeY: number;
  /** Free space between text block bottom and footer safe line (may be 0). */
  remainingBelowText: number;
  /** Internal blank between image bottom and text top beyond gap — should be ~0. */
  internalDeadZone: number;
};

export type AllocateImageBackedBandResult = {
  image: ImageBandGeometry;
  textBandTop: number;
  kickerY: number;
  headlineY: number;
  maxHeadlineHeight: number;
  maxBodyHeight: number;
  footerSafeY: number;
  metrics: ContentAwareBandMetrics;
  /** True when measured text cannot fit even at min image + min gap. */
  textOverflow: boolean;
};

/**
 * Measure total text stack height from fitted line boxes + gaps.
 * Matches svg.ts stacking: headline block then headlineBodyGap then body.
 */
export function measureTextBlockHeight(input: {
  hasKicker: boolean;
  kickerFontPx?: number;
  headlineHeight: number;
  bodyHeight: number;
  headlineBodyGapPx: number;
  headlineFontPx: number;
}): number {
  const kickerFont = input.kickerFontPx ?? 20;
  if (!input.hasKicker) {
    const ascent = Math.round(input.headlineFontPx * 0.82);
    return (
      ascent +
      Math.max(0, input.headlineHeight) +
      (input.bodyHeight > 0 ? input.headlineBodyGapPx + input.bodyHeight : 0)
    );
  }
  const kickerAscent = Math.round(kickerFont * 0.82);
  const clear = 32;
  const headlineAscent = Math.round(input.headlineFontPx * 0.82);
  return (
    kickerAscent +
    clear +
    headlineAscent +
    Math.max(0, input.headlineHeight) +
    (input.bodyHeight > 0 ? input.headlineBodyGapPx + input.bodyHeight : 0)
  );
}

export function headlineBodyGapForDensity(
  density: CardTextDensity,
  geometry: CardNewsGeometry,
): number {
  return geometry.scaleY(HEADLINE_BODY_GAP[density] ?? HEADLINE_BODY_GAP.standard);
}

/**
 * Allocate photo_top / evidence image height from measured text (content-aware).
 */
export function allocateImageBackedBand(input: {
  geometry: CardNewsGeometry;
  template: "photo_top_story" | "evidence_detail" | "photo_bottom_story";
  preferredImageRatio: number | undefined;
  textBlockHeight: number;
  headlineFontPx: number;
  hasKicker: boolean;
  hasCitation?: boolean;
}): AllocateImageBackedBandResult {
  const geo = input.geometry;
  const platform = resolvePlatformLayout(geo.aspectRatio);
  const bounds = imageRatioBoundsForTemplate(input.template, input.preferredImageRatio)!;
  const footerSafeY =
    geo.height -
    geo.scaleY(platform.footerReservePx) -
    (input.hasCitation ? geo.scaleY(platform.citationReservePx) : 0);

  const gapMin = geo.scaleY(IMAGE_TEXT_GAP.min);
  const gapPreferred = geo.scaleY(IMAGE_TEXT_GAP.preferred);
  const gapMax = geo.scaleY(IMAGE_TEXT_GAP.max);

  const inset = input.template === "evidence_detail" ? 48 : 0;
  const imageTop =
    input.template === "evidence_detail"
      ? geo.scaleY(80)
      : geo.scaleY(platform.topSafePx);

  const usableBelowImageTop = footerSafeY - imageTop;
  const minH = Math.round(geo.height * bounds.min);
  const maxH = Math.round(geo.height * bounds.max);
  const preferredH = Math.round(geo.height * bounds.preferred);

  let gap = gapPreferred;
  let availableForImageAndGap = usableBelowImageTop - input.textBlockHeight;
  let imageH = availableForImageAndGap - gap;
  let textOverflow = false;

  if (availableForImageAndGap < minH + gapMin) {
    // Even min image + min gap overflows — lock mins; caller must font-fit.
    gap = gapMin;
    imageH = minH;
    textOverflow = true;
  } else if (imageH > maxH) {
    imageH = maxH;
    const leftover = availableForImageAndGap - imageH - gap;
    if (leftover > 0) {
      const grow = Math.min(gapMax - gap, leftover);
      gap += Math.max(0, grow);
    }
  } else if (imageH < minH) {
    gap = gapMin;
    imageH = availableForImageAndGap - gap;
    if (imageH < minH) {
      imageH = minH;
      textOverflow = true;
    }
  } else {
    // In range: bias toward preferred when there is slack without creating dead zone.
    // Prefer expanding image (already done via remainder absorption). Optional: if
    // imageH is below preferred and we can grow without exceeding max, grow toward preferred.
    if (imageH < preferredH && preferredH <= maxH) {
      const room = availableForImageAndGap - gapMin;
      const target = Math.min(preferredH, room, maxH);
      if (target > imageH) {
        imageH = target;
        gap = Math.max(gapMin, availableForImageAndGap - imageH);
        gap = Math.min(gap, gapMax);
      }
    }
  }

  imageH = Math.max(1, Math.round(imageH));
  gap = Math.max(gapMin, Math.round(gap));

  const imageBottom = imageTop + imageH;
  const textBandTop = imageBottom + gap;
  const anchors = resolveTextBandAnchors({
    bandTopY: textBandTop,
    headlineFontPx: input.headlineFontPx,
    hasKicker: input.hasKicker,
  });

  const textBottom = textBandTop + input.textBlockHeight;
  const remainingBelowText = Math.max(0, footerSafeY - textBottom);
  const maxBodyHeight = Math.max(48, footerSafeY - anchors.headlineY - geo.scaleY(24));
  const maxHeadlineHeight = Math.max(48, Math.round(maxBodyHeight * 0.55));

  const image: ImageBandGeometry = {
    x: inset,
    y: imageTop,
    width: geo.width - inset * 2,
    height: imageH,
    rx: input.template === "evidence_detail" ? 12 : 0,
  };

  return {
    image,
    textBandTop,
    kickerY: anchors.kickerY,
    headlineY: anchors.headlineY,
    maxHeadlineHeight,
    maxBodyHeight,
    footerSafeY,
    metrics: {
      imageTop,
      imageBottom,
      imageHeight: imageH,
      actualImageRatio: imageH / geo.height,
      preferredImageRatio: bounds.preferred,
      imageTextGap: gap,
      textBandTop,
      textBlockHeight: input.textBlockHeight,
      footerSafeY,
      remainingBelowText,
      internalDeadZone: Math.max(0, textBandTop - imageBottom - gap),
    },
    textOverflow,
  };
}

/**
 * Closing / text_statement: optical vertical balance inside usable region.
 * textPlacement is a soft bias only — never footer-flush.
 */
export function allocateClosingTextBand(input: {
  geometry: CardNewsGeometry;
  textBlockHeight: number;
  headlineFontPx: number;
  hasKicker: boolean;
  /** Secondary optical hint from presentation. */
  textPlacement?: string;
  platform?: InstagramPlatformLayout;
}): {
  textBandTop: number;
  kickerY: number;
  headlineY: number;
  maxHeadlineHeight: number;
  maxBodyHeight: number;
  footerSafeY: number;
  metrics: Omit<
    ContentAwareBandMetrics,
    | "imageTop"
    | "imageBottom"
    | "imageHeight"
    | "actualImageRatio"
    | "preferredImageRatio"
    | "imageTextGap"
    | "internalDeadZone"
  > & { opticalBias: number };
} {
  const geo = input.geometry;
  const platform = input.platform ?? resolvePlatformLayout(geo.aspectRatio);
  const topSafe = geo.scaleY(Math.max(platform.topSafePx, 48));
  const footerSafeY = geo.height - geo.scaleY(platform.footerReservePx);
  const usable = Math.max(0, footerSafeY - topSafe);
  const textH = Math.min(input.textBlockHeight, usable);
  const leftover = Math.max(0, usable - textH);

  // Balanced middle with slight below-center bias; "bottom" tip biases further down
  // but never flush to footer (keep ≥ 8% usable as lower air).
  let bias = 0.42;
  if (input.textPlacement === "bottom") bias = 0.5;
  if (input.textPlacement === "top") bias = 0.28;
  const minLowerAir = Math.round(usable * 0.08);
  let bandTop = topSafe + Math.round(leftover * bias);
  const maxBandTop = footerSafeY - textH - minLowerAir;
  bandTop = Math.min(bandTop, Math.max(topSafe, maxBandTop));

  const anchors = resolveTextBandAnchors({
    bandTopY: bandTop,
    headlineFontPx: input.headlineFontPx,
    hasKicker: input.hasKicker,
  });

  return {
    textBandTop: bandTop,
    kickerY: anchors.kickerY,
    headlineY: anchors.headlineY,
    maxHeadlineHeight: Math.max(64, Math.round(usable * 0.45)),
    maxBodyHeight: Math.max(64, footerSafeY - anchors.headlineY - geo.scaleY(24)),
    footerSafeY,
    metrics: {
      textBandTop: bandTop,
      textBlockHeight: textH,
      footerSafeY,
      remainingBelowText: Math.max(0, footerSafeY - (bandTop + textH)),
      opticalBias: bias,
    },
  };
}
