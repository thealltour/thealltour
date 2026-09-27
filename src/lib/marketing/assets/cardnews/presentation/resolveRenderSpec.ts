/**
 * Merge editorial card + presentation + visual → ResolvedCardRenderSpec.
 * Renderer executes this spec only — no further editorial decisions.
 *
 * v2.3: photo_top / evidence use content-aware image-height allocation.
 * v2.5: cover_full_bleed + photo_overlay_editorial share full-bleed overlay family
 * (image never shrinks; text band expands / fonts shrink within lower safe region).
 * v2.6: wider overlay text column, cover/story body parity, brand-signature closing.
 */

import type { CardNewsCard, CardNewsRole } from "@/lib/marketing/assets/contracts";
import type { CardNewsGeometry } from "@/lib/marketing/assets/cardnews/brand";
import type { FittedText } from "@/lib/marketing/assets/cardnews/textLayout";
import { fitText } from "@/lib/marketing/assets/cardnews/textLayout";
import { CARDNEWS_BRAND, CARDNEWS_SAFE } from "@/lib/marketing/assets/cardnews/brand";
import type { CardPresentation } from "@/lib/marketing/assets/cardnews/presentation/contracts";
import {
  densityBodyPx,
  densityHeadlinePx,
  estimateGlyphBottom,
  estimateGlyphTop,
  focalToPreserveAspectRatio,
  resolveTemplateLayout,
  resolveTextBandAnchors,
  type ResolvedTemplateLayout,
} from "@/lib/marketing/assets/cardnews/presentation/templateGeometry";
import {
  allocateClosingTextBand,
  allocateImageBackedBand,
  headlineBodyGapForDensity,
  measureTextBlockHeight,
} from "@/lib/marketing/assets/cardnews/presentation/contentAwareLayout";
import { resolvePlatformLayout } from "@/lib/marketing/assets/cardnews/presentation/platformLayout";
import type { CardCitation } from "@/lib/marketing/assets/cardnews/svg";
import {
  TYPOGRAPHY_BODY_FILL_PAPER,
  TYPOGRAPHY_LINE_HEIGHT,
  formatScaleForAspect,
} from "@/lib/marketing/assets/cardnews/typographyTokens";
import { paperTextMaxWidth } from "@/lib/marketing/assets/cardnews/overlayTextInsets";

export type ResolvedCardRenderSpec = {
  cardId: string;
  /** Internal presentation role — not rendered as on-card text. */
  role: CardNewsRole;
  index: number;
  total: number;
  /** Optional explicit editorial kicker; empty when absent. Never role-derived. */
  kicker: string;
  headline: FittedText;
  body: FittedText;
  citation: CardCitation | null;
  visualDataUri: string | null;
  wordmarkDataUri: string | null;
  presentation: CardPresentation;
  layout: ResolvedTemplateLayout;
  /** Headline↔body gap used by svg (density-aware). */
  headlineBodyGapPx: number;
};

const KICKER_FONT_PX = 20;

/** Trim / reject blank; never invent copy from role or index. */
export function normalizeExplicitEditorialKicker(
  value: string | null | undefined,
): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : "";
}

/** Drop kicker when layout would still place it inside the headline glyph box. */
function kickerSafeForHeadline(
  kicker: string,
  layout: ResolvedTemplateLayout,
  headlineFontPx: number,
): string {
  if (!kicker) return "";
  const kickerBottom = estimateGlyphBottom(layout.text.kickerY, KICKER_FONT_PX);
  const headlineTop = estimateGlyphTop(layout.text.y, headlineFontPx);
  if (headlineTop < kickerBottom + 24) return "";
  return kicker;
}

function applyMobileLineHeights(
  template: ResolvedTemplateLayout["template"],
  headline: FittedText,
  body: FittedText,
): void {
  const headlineMult =
    template === "cover_full_bleed" || template === "text_statement"
      ? 1.15
      : TYPOGRAPHY_LINE_HEIGHT.headline;
  const bodyMult = TYPOGRAPHY_LINE_HEIGHT.body;
  headline.lineHeight = Math.round(headline.fontSize * headlineMult);
  headline.height = headline.lines.length * headline.lineHeight;
  body.lineHeight = Math.round(body.fontSize * bodyMult);
  body.height = body.lines.length * body.lineHeight;
}

function fitPair(input: {
  card: CardNewsCard;
  textWidth: number;
  headlinePreferred: number;
  bodyPreferred: number;
  maxHeadlineHeight: number;
  maxBodyHeight: number;
  maxLinesHeadline: number;
  maxLinesBody: number;
}): { headline: FittedText; body: FittedText } {
  const headline = fitText({
    text: input.card.headline,
    preferredFontSize: input.headlinePreferred,
    minFontSize: CARDNEWS_SAFE.minHeadlinePx,
    maxWidth: input.textWidth,
    maxHeight: input.maxHeadlineHeight,
    maxLines: input.maxLinesHeadline,
    overflow: "error",
    cardId: input.card.cardId,
    field: "headline",
  });
  const body = fitText({
    text: input.card.body,
    preferredFontSize: input.bodyPreferred,
    minFontSize: CARDNEWS_SAFE.minBodyPx,
    maxWidth: input.textWidth,
    maxHeight: input.maxBodyHeight,
    maxLines: input.maxLinesBody,
    overflow: "error",
    cardId: input.card.cardId,
    field: "body",
  });
  return { headline, body };
}

function brandSubtle(geo: CardNewsGeometry, opacity: number) {
  return {
    wordmark: {
      x: 80,
      y: geo.height - geo.scaleY(72),
      width: 200,
      height: 36,
      opacity,
    },
    progressY: geo.height - geo.scaleY(96),
    showTopBar: false,
    showBottomAccent: false,
  };
}

/** Brand-signature closing footer — larger wordmark + rule, no CTA copy. */
function brandSignatureClosing(geo: CardNewsGeometry) {
  return {
    wordmark: {
      x: 80,
      y: geo.height - geo.scaleY(156),
      width: 340,
      height: 58,
      opacity: 0.95,
    },
    progressY: geo.height - geo.scaleY(48),
    showTopBar: true,
    showBottomAccent: true,
    signatureRule: {
      x: 80,
      y: geo.height - geo.scaleY(186),
      width: 112,
      height: 2,
    },
    showEditorialAccent: true,
    editorialAccentY: geo.scaleY(72),
  };
}

function buildContentAwareImageBackedSpec(input: {
  card: CardNewsCard;
  index: number;
  total: number;
  presentation: CardPresentation;
  citation: CardCitation | null;
  visualDataUri: string | null;
  wordmarkDataUri: string | null;
  geometry: CardNewsGeometry;
  explicitKicker: string;
  template: "photo_top_story" | "evidence_detail";
}): ResolvedCardRenderSpec {
  const geo = input.geometry;
  const p = input.presentation;
  const density = input.template === "evidence_detail" ? "compact" : p.textDensity;
  const textWidth = paperTextMaxWidth(geo.width);
  const headlinePreferred = densityHeadlinePx(density, false, false);
  const bodyPreferred = densityBodyPx(density, false, false);
  const headlineBodyGapPx = headlineBodyGapForDensity(density, geo);
  const hasKicker = Boolean(input.explicitKicker);
  const maxLinesHeadline = 4;
  const maxLinesBody = 8;

  // Pass 1: measure at preferred sizes with generous vertical room.
  const probe = fitPair({
    card: input.card,
    textWidth,
    headlinePreferred,
    bodyPreferred,
    maxHeadlineHeight: geo.scaleY(420),
    maxBodyHeight: geo.scaleY(520),
    maxLinesHeadline,
    maxLinesBody,
  });
  applyMobileLineHeights(input.template, probe.headline, probe.body);

  let textBlockHeight = measureTextBlockHeight({
    hasKicker,
    headlineHeight: probe.headline.height,
    bodyHeight: probe.body.height,
    headlineBodyGapPx,
    headlineFontPx: probe.headline.fontSize,
  });

  let alloc = allocateImageBackedBand({
    geometry: geo,
    template: input.template,
    preferredImageRatio: p.imageHeightRatio,
    textBlockHeight,
    headlineFontPx: probe.headline.fontSize,
    hasKicker,
    hasCitation: Boolean(input.citation),
  });

  // Pass 2: if overflow at min image/gap, shrink fonts into remaining text budget
  // (body first, then headline) — never truncate.
  let headline = probe.headline;
  let body = probe.body;
  if (alloc.textOverflow) {
    const bandTop = alloc.image.y + alloc.image.height + alloc.metrics.imageTextGap;
    const textBudget = Math.max(64, alloc.footerSafeY - bandTop);
    let fitted: { headline: FittedText; body: FittedText } | null = null;
    let bodyTry = bodyPreferred;
    let headlineTry = headlinePreferred;
    while (bodyTry >= CARDNEWS_SAFE.minBodyPx || headlineTry >= CARDNEWS_SAFE.minHeadlinePx) {
      const candidate = fitPair({
        card: input.card,
        textWidth,
        headlinePreferred: headlineTry,
        bodyPreferred: bodyTry,
        maxHeadlineHeight: Math.max(48, Math.round(textBudget * 0.5)),
        maxBodyHeight: Math.max(48, textBudget),
        maxLinesHeadline,
        maxLinesBody: Math.max(maxLinesBody, 10),
      });
      applyMobileLineHeights(input.template, candidate.headline, candidate.body);
      const blockH = measureTextBlockHeight({
        hasKicker,
        headlineHeight: candidate.headline.height,
        bodyHeight: candidate.body.height,
        headlineBodyGapPx,
        headlineFontPx: candidate.headline.fontSize,
      });
      if (blockH <= textBudget) {
        fitted = candidate;
        break;
      }
      if (bodyTry > CARDNEWS_SAFE.minBodyPx) {
        bodyTry -= 1;
      } else if (headlineTry > CARDNEWS_SAFE.minHeadlinePx) {
        headlineTry -= 1;
      } else {
        break;
      }
    }
    if (!fitted) {
      // Last attempt: locked mins with full budget — surface typed overflow if still impossible.
      fitted = fitPair({
        card: input.card,
        textWidth,
        headlinePreferred: CARDNEWS_SAFE.minHeadlinePx,
        bodyPreferred: CARDNEWS_SAFE.minBodyPx,
        maxHeadlineHeight: Math.max(48, Math.round(textBudget * 0.45)),
        maxBodyHeight: Math.max(48, Math.round(textBudget * 0.7)),
        maxLinesHeadline,
        maxLinesBody: Math.max(maxLinesBody, 10),
      });
      applyMobileLineHeights(input.template, fitted.headline, fitted.body);
    }
    headline = fitted.headline;
    body = fitted.body;
    textBlockHeight = measureTextBlockHeight({
      hasKicker,
      headlineHeight: headline.height,
      bodyHeight: body.height,
      headlineBodyGapPx,
      headlineFontPx: headline.fontSize,
    });
    alloc = allocateImageBackedBand({
      geometry: geo,
      template: input.template,
      preferredImageRatio: p.imageHeightRatio,
      textBlockHeight,
      headlineFontPx: headline.fontSize,
      hasKicker,
      hasCitation: Boolean(input.citation),
    });
  }

  const layout: ResolvedTemplateLayout = {
    template: input.template,
    image: alloc.image,
    text: {
      x: 80,
      y: alloc.headlineY,
      width: textWidth,
      maxHeadlineHeight: alloc.maxHeadlineHeight,
      maxBodyHeight: alloc.maxBodyHeight,
      kickerY: alloc.kickerY,
      headlinePreferred,
      bodyPreferred,
      fill: CARDNEWS_BRAND.paper,
      headlineFill: CARDNEWS_BRAND.ink,
      bodyFill: TYPOGRAPHY_BODY_FILL_PAPER,
      kickerFill: CARDNEWS_BRAND.blue,
    },
    overlay: null,
    brand: brandSubtle(geo, input.template === "evidence_detail" ? 0.35 : 0.4),
    cropMode: p.cropMode ?? "cover",
    focalAlignment: p.focalAlignment ?? "center",
    preserveAspectRatio: focalToPreserveAspectRatio(
      p.focalAlignment ?? "center",
      p.cropMode ?? "cover",
    ),
    textDensity: density,
    textPlacement: p.textPlacement,
    contentAware: {
      imageTextGap: alloc.metrics.imageTextGap,
      textBandTop: alloc.metrics.textBandTop,
      textBlockHeight: alloc.metrics.textBlockHeight,
      footerSafeY: alloc.metrics.footerSafeY,
      preferredImageRatio: alloc.metrics.preferredImageRatio,
      actualImageRatio: alloc.metrics.actualImageRatio,
      remainingBelowText: alloc.metrics.remainingBelowText,
      internalDeadZone: alloc.metrics.internalDeadZone,
    },
  };

  const kicker = kickerSafeForHeadline(input.explicitKicker, layout, headline.fontSize);

  return {
    cardId: input.card.cardId,
    role: input.card.role,
    index: input.index,
    total: input.total,
    kicker,
    headline,
    body,
    citation: input.citation,
    visualDataUri: input.visualDataUri,
    wordmarkDataUri: input.wordmarkDataUri,
    presentation: input.presentation,
    layout,
    headlineBodyGapPx,
  };
}

function buildContentAwareClosingSpec(input: {
  card: CardNewsCard;
  index: number;
  total: number;
  presentation: CardPresentation;
  citation: CardCitation | null;
  visualDataUri: string | null;
  wordmarkDataUri: string | null;
  geometry: CardNewsGeometry;
  explicitKicker: string;
}): ResolvedCardRenderSpec {
  const geo = input.geometry;
  const p = input.presentation;
  const isClosing = p.template === "closing_insight";
  const density = p.textDensity;
  const textWidth = paperTextMaxWidth(geo.width);
  const headlinePreferred = Math.max(
    densityHeadlinePx(density, false, !isClosing),
    isClosing ? 64 : 72,
  );
  const bodyPreferred = densityBodyPx(density, false, !isClosing);
  const headlineBodyGapPx = headlineBodyGapForDensity(density, geo);
  const hasKicker = Boolean(input.explicitKicker);
  const maxLinesBody = isClosing ? 8 : 6;
  // Brand signature needs footer air; keep text above the lockup.
  const closingPlatform = isClosing
    ? {
        ...resolvePlatformLayout(geo.aspectRatio),
        footerReservePx: 220,
      }
    : undefined;

  const probe = fitPair({
    card: input.card,
    textWidth,
    headlinePreferred,
    bodyPreferred,
    maxHeadlineHeight: geo.scaleY(420),
    maxBodyHeight: geo.scaleY(480),
    maxLinesHeadline: 4,
    maxLinesBody,
  });
  applyMobileLineHeights(isClosing ? "closing_insight" : "text_statement", probe.headline, probe.body);

  let textBlockHeight = measureTextBlockHeight({
    hasKicker,
    headlineHeight: probe.headline.height,
    bodyHeight: probe.body.height,
    headlineBodyGapPx,
    headlineFontPx: probe.headline.fontSize,
  });

  let alloc = allocateClosingTextBand({
    geometry: geo,
    textBlockHeight,
    headlineFontPx: probe.headline.fontSize,
    hasKicker,
    textPlacement: p.textPlacement,
    platform: closingPlatform,
  });

  let headline = probe.headline;
  let body = probe.body;
  if (textBlockHeight > alloc.footerSafeY - alloc.textBandTop) {
    const budget = Math.max(64, alloc.footerSafeY - alloc.textBandTop);
    const fitted = fitPair({
      card: input.card,
      textWidth,
      headlinePreferred,
      bodyPreferred,
      maxHeadlineHeight: Math.round(budget * 0.5),
      maxBodyHeight: Math.round(budget * 0.5),
      maxLinesHeadline: 4,
      maxLinesBody,
    });
    applyMobileLineHeights(
      isClosing ? "closing_insight" : "text_statement",
      fitted.headline,
      fitted.body,
    );
    headline = fitted.headline;
    body = fitted.body;
    textBlockHeight = measureTextBlockHeight({
      hasKicker,
      headlineHeight: headline.height,
      bodyHeight: body.height,
      headlineBodyGapPx,
      headlineFontPx: headline.fontSize,
    });
    alloc = allocateClosingTextBand({
      geometry: geo,
      textBlockHeight,
      headlineFontPx: headline.fontSize,
      hasKicker,
      textPlacement: p.textPlacement,
      platform: closingPlatform,
    });
  }

  const layout: ResolvedTemplateLayout = {
    template: isClosing ? "closing_insight" : "text_statement",
    image: null,
    text: {
      x: 80,
      y: alloc.headlineY,
      width: textWidth,
      maxHeadlineHeight: alloc.maxHeadlineHeight,
      maxBodyHeight: alloc.maxBodyHeight,
      kickerY: alloc.kickerY,
      headlinePreferred,
      bodyPreferred,
      fill: CARDNEWS_BRAND.paper,
      headlineFill: CARDNEWS_BRAND.ink,
      bodyFill: TYPOGRAPHY_BODY_FILL_PAPER,
      kickerFill: isClosing ? CARDNEWS_BRAND.orange : CARDNEWS_BRAND.blue,
    },
    overlay: null,
    brand: isClosing
      ? brandSignatureClosing(geo)
      : {
          ...brandSubtle(geo, 0.4),
          showTopBar: true,
          showBottomAccent: false,
        },
    cropMode: p.cropMode ?? "cover",
    focalAlignment: p.focalAlignment ?? "center",
    preserveAspectRatio: "xMidYMid slice",
    textDensity: density,
    textPlacement: p.textPlacement,
    contentAware: {
      textBandTop: alloc.textBandTop,
      textBlockHeight,
      footerSafeY: alloc.footerSafeY,
      remainingBelowText: alloc.metrics.remainingBelowText,
    },
  };

  const kicker = kickerSafeForHeadline(input.explicitKicker, layout, headline.fontSize);

  return {
    cardId: input.card.cardId,
    role: input.card.role,
    index: input.index,
    total: input.total,
    kicker,
    headline,
    body,
    citation: input.citation,
    visualDataUri: input.visualDataUri,
    wordmarkDataUri: input.wordmarkDataUri,
    presentation: input.presentation,
    layout,
    headlineBodyGapPx,
  };
}

/**
 * cover_full_bleed + photo_overlay_editorial: full-bleed image, lower-third text.
 * Fit order: preferred size → wrap → gap shrink → raise band → bounded font shrink.
 * Never shrinks image height; never truncates.
 */
function buildFullBleedOverlaySpec(input: {
  card: CardNewsCard;
  index: number;
  total: number;
  presentation: CardPresentation;
  citation: CardCitation | null;
  visualDataUri: string | null;
  wordmarkDataUri: string | null;
  geometry: CardNewsGeometry;
  explicitKicker: string;
  headlineBodyGapPx: number;
}): ResolvedCardRenderSpec {
  const base = resolveTemplateLayout({
    presentation: input.presentation,
    geometry: input.geometry,
    hasVisual: true,
    roleHint: input.card.role,
    hasKicker: Boolean(input.explicitKicker),
  });
  const geo = input.geometry;
  const isCover = input.presentation.template === "cover_full_bleed";
  const maxLinesHeadline = isCover ? 3 : 4;
  const maxLinesBody = isCover ? 5 : 6;
  const bottomPad = geo.scaleY(48);
  const textWidth = base.text.width;
  const formatScale = formatScaleForAspect(geo.aspectRatio);
  const headlinePreferred = Math.round(base.text.headlinePreferred * formatScale);
  const bodyPreferred = Math.round(base.text.bodyPreferred * formatScale);
  const hasKicker = Boolean(input.explicitKicker);
  let gapPx = input.headlineBodyGapPx;
  const gapMin = Math.max(geo.scaleY(14), Math.round(input.headlineBodyGapPx * 0.65));

  let { headline, body } = fitPair({
    card: input.card,
    textWidth,
    headlinePreferred,
    bodyPreferred,
    maxHeadlineHeight: geo.scaleY(260),
    maxBodyHeight: geo.scaleY(320),
    maxLinesHeadline,
    maxLinesBody,
  });
  applyMobileLineHeights(base.template, headline, body);

  let textBlockHeight = measureTextBlockHeight({
    hasKicker,
    headlineHeight: headline.height,
    bodyHeight: body.height,
    headlineBodyGapPx: gapPx,
    headlineFontPx: headline.fontSize,
  });

  const footerLimit = geo.height - bottomPad;
  // Preferred lower band — consistent series geometry; expand upward only when needed.
  const preferredBandTop =
    geo.height -
    geo.scaleY(hasKicker ? (isCover ? 380 : 400) : isCover ? 340 : 360) +
    geo.scaleY(hasKicker ? 28 : 40);
  const minBandTop = geo.scaleY(isCover ? 420 : 380);
  let bandTop = preferredBandTop;

  if (preferredBandTop + textBlockHeight > footerLimit) {
    // 3) shrink gap first
    while (gapPx > gapMin && preferredBandTop + textBlockHeight > footerLimit) {
      gapPx -= 2;
      textBlockHeight = measureTextBlockHeight({
        hasKicker,
        headlineHeight: headline.height,
        bodyHeight: body.height,
        headlineBodyGapPx: gapPx,
        headlineFontPx: headline.fontSize,
      });
    }
  }

  if (preferredBandTop + textBlockHeight > footerLimit) {
    // 4) expand band upward within allowed range
    bandTop = Math.max(minBandTop, footerLimit - textBlockHeight);
  }

  if (bandTop + textBlockHeight > footerLimit) {
    // 5) bounded font shrink into remaining budget
    const budget = Math.max(64, footerLimit - Math.max(minBandTop, bandTop));
    const refit = fitPair({
      card: input.card,
      textWidth,
      headlinePreferred,
      bodyPreferred,
      maxHeadlineHeight: Math.round(budget * 0.42),
      maxBodyHeight: Math.round(budget * 0.58),
      maxLinesHeadline,
      maxLinesBody,
    });
    applyMobileLineHeights(base.template, refit.headline, refit.body);
    headline = refit.headline;
    body = refit.body;
    textBlockHeight = measureTextBlockHeight({
      hasKicker,
      headlineHeight: headline.height,
      bodyHeight: body.height,
      headlineBodyGapPx: gapPx,
      headlineFontPx: headline.fontSize,
    });
    bandTop = Math.max(minBandTop, footerLimit - textBlockHeight);
  }

  const anchors = resolveTextBandAnchors({
    bandTopY: bandTop,
    headlineFontPx: headline.fontSize,
    hasKicker,
  });
  const gradientLead = geo.scaleY(isCover ? 48 : 72);
  const layout: ResolvedTemplateLayout = {
    ...base,
    // Full-bleed invariant
    image: { x: 0, y: 0, width: geo.width, height: geo.height, rx: 0 },
    text: {
      ...base.text,
      y: anchors.headlineY,
      kickerY: anchors.kickerY,
      maxHeadlineHeight: geo.scaleY(200),
      maxBodyHeight: Math.max(48, footerLimit - anchors.headlineY),
    },
    overlay: {
      mode: base.overlay?.mode ?? "gradient_dark",
      y: Math.max(0, bandTop - gradientLead),
      height: geo.height - Math.max(0, bandTop - gradientLead),
    },
    contentAware: {
      textBandTop: bandTop,
      textBlockHeight,
      footerSafeY: footerLimit,
      remainingBelowText: Math.max(0, footerLimit - (bandTop + textBlockHeight)),
    },
  };

  const kicker = kickerSafeForHeadline(input.explicitKicker, layout, headline.fontSize);
  return {
    cardId: input.card.cardId,
    role: input.card.role,
    index: input.index,
    total: input.total,
    kicker,
    headline,
    body,
    citation: input.citation,
    visualDataUri: input.visualDataUri,
    wordmarkDataUri: input.wordmarkDataUri,
    presentation: input.presentation,
    layout,
    headlineBodyGapPx: gapPx,
  };
}

export function buildResolvedCardRenderSpec(input: {
  card: CardNewsCard;
  index: number;
  total: number;
  presentation: CardPresentation;
  citation: CardCitation | null;
  visualDataUri: string | null;
  wordmarkDataUri: string | null;
  geometry: CardNewsGeometry;
  /**
   * Optional user-facing editorial kicker. Card role / index must never be
   * used as a fallback — omit or pass null/"" when the brief has none.
   */
  editorialKicker?: string | null;
}): ResolvedCardRenderSpec {
  const hasVisual = Boolean(input.visualDataUri);
  const explicitKicker = normalizeExplicitEditorialKicker(input.editorialKicker);
  const template = input.presentation.template;
  const headlineBodyGapPx = headlineBodyGapForDensity(
    input.presentation.textDensity,
    input.geometry,
  );

  // Full-bleed overlay family: image fills canvas; copy fits in lower band.
  if (
    hasVisual &&
    (template === "cover_full_bleed" || template === "photo_overlay_editorial")
  ) {
    return buildFullBleedOverlaySpec({
      ...input,
      explicitKicker,
      headlineBodyGapPx,
    });
  }

  if (
    hasVisual &&
    (template === "photo_top_story" || template === "evidence_detail")
  ) {
    return buildContentAwareImageBackedSpec({
      ...input,
      explicitKicker,
      template,
    });
  }

  if (
    !hasVisual ||
    template === "closing_insight" ||
    template === "text_statement"
  ) {
    return buildContentAwareClosingSpec({
      ...input,
      explicitKicker,
    });
  }

  // Remaining overlay / photo_bottom: keep prior templateGeometry + fit path.
  const layout = resolveTemplateLayout({
    presentation: input.presentation,
    geometry: input.geometry,
    hasVisual,
    roleHint: input.card.role,
    hasKicker: Boolean(explicitKicker),
  });
  const maxLinesHeadline =
    layout.template === "cover_full_bleed" || layout.template === "text_statement" ? 3 : 4;
  const maxLinesBody = layout.template === "closing_insight" ? 5 : 6;
  const { headline, body } = fitPair({
    card: input.card,
    textWidth: layout.text.width,
    headlinePreferred: layout.text.headlinePreferred,
    bodyPreferred: layout.text.bodyPreferred,
    maxHeadlineHeight: layout.text.maxHeadlineHeight,
    maxBodyHeight: layout.text.maxBodyHeight,
    maxLinesHeadline,
    maxLinesBody,
  });
  applyMobileLineHeights(layout.template, headline, body);
  const kicker = kickerSafeForHeadline(explicitKicker, layout, headline.fontSize);
  return {
    cardId: input.card.cardId,
    role: input.card.role,
    index: input.index,
    total: input.total,
    kicker,
    headline,
    body,
    citation: input.citation,
    visualDataUri: input.visualDataUri,
    wordmarkDataUri: input.wordmarkDataUri,
    presentation: input.presentation,
    layout,
    headlineBodyGapPx,
  };
}
