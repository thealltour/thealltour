/**
 * Merge editorial card + presentation + visual → ResolvedCardRenderSpec.
 * Renderer executes this spec only — no further editorial decisions.
 *
 * v2.3: image-backed + closing templates use content-aware vertical allocation
 * (measured text first; imageHeightRatio = preferred hint).
 * cover_full_bleed stays on templateGeometry golden path.
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
import type { CardCitation } from "@/lib/marketing/assets/cardnews/svg";
import {
  TYPOGRAPHY_BODY_FILL_PAPER,
  TYPOGRAPHY_LINE_HEIGHT,
} from "@/lib/marketing/assets/cardnews/typographyTokens";

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
  const bodyMult =
    template === "cover_full_bleed" ? TYPOGRAPHY_LINE_HEIGHT.coverBody : TYPOGRAPHY_LINE_HEIGHT.body;
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
  const textWidth = geo.width - 80 * 2;
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
  const textWidth = geo.width - 80 * 2;
  const headlinePreferred = Math.max(
    densityHeadlinePx(density, false, !isClosing),
    isClosing ? 64 : 72,
  );
  const bodyPreferred = densityBodyPx(density, false, !isClosing);
  const headlineBodyGapPx = headlineBodyGapForDensity(density, geo);
  const hasKicker = Boolean(input.explicitKicker);
  const maxLinesBody = isClosing ? 8 : 6;

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
    brand: {
      ...brandSubtle(geo, isClosing ? 0.9 : 0.4),
      showTopBar: true,
      showBottomAccent: isClosing,
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

  // cover_full_bleed: full-bleed image stays golden; denser copy may raise overlay/text band.
  if (hasVisual && template === "cover_full_bleed") {
    const base = resolveTemplateLayout({
      presentation: input.presentation,
      geometry: input.geometry,
      hasVisual,
      roleHint: input.card.role,
      hasKicker: Boolean(explicitKicker),
    });
    const geo = input.geometry;
    const maxLinesHeadline = 3;
    const maxLinesBody = 5;
    const bottomPad = geo.scaleY(48);
    const textWidth = base.text.width;
    const hasKicker = Boolean(explicitKicker);

    let { headline, body } = fitPair({
      card: input.card,
      textWidth,
      headlinePreferred: base.text.headlinePreferred,
      bodyPreferred: base.text.bodyPreferred,
      maxHeadlineHeight: geo.scaleY(240),
      maxBodyHeight: geo.scaleY(280),
      maxLinesHeadline,
      maxLinesBody,
    });
    applyMobileLineHeights(base.template, headline, body);

    let textBlockHeight = measureTextBlockHeight({
      hasKicker,
      headlineHeight: headline.height,
      bodyHeight: body.height,
      headlineBodyGapPx,
      headlineFontPx: headline.fontSize,
    });

    const footerLimit = geo.height - bottomPad;
    const goldenBandTop =
      geo.height - geo.scaleY(hasKicker ? 380 : 340) + geo.scaleY(hasKicker ? 28 : 40);
    let bandTop = goldenBandTop;
    if (goldenBandTop + textBlockHeight > footerLimit) {
      const minBandTop = geo.scaleY(420);
      bandTop = Math.max(minBandTop, footerLimit - textBlockHeight);
      const budget = Math.max(64, footerLimit - bandTop);
      const refit = fitPair({
        card: input.card,
        textWidth,
        headlinePreferred: base.text.headlinePreferred,
        bodyPreferred: base.text.bodyPreferred,
        maxHeadlineHeight: Math.round(budget * 0.45),
        maxBodyHeight: Math.round(budget * 0.55),
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
        headlineBodyGapPx,
        headlineFontPx: headline.fontSize,
      });
      bandTop = Math.max(minBandTop, footerLimit - textBlockHeight);
    }

    const anchors = resolveTextBandAnchors({
      bandTopY: bandTop,
      headlineFontPx: headline.fontSize,
      hasKicker,
    });
    const layout: ResolvedTemplateLayout = {
      ...base,
      text: {
        ...base.text,
        y: anchors.headlineY,
        kickerY: anchors.kickerY,
        maxHeadlineHeight: geo.scaleY(200),
        maxBodyHeight: Math.max(48, footerLimit - anchors.headlineY),
      },
      overlay: {
        mode: base.overlay?.mode ?? "gradient_dark",
        y: Math.max(0, bandTop - geo.scaleY(40)),
        height: geo.height - Math.max(0, bandTop - geo.scaleY(40)),
      },
      contentAware: {
        textBandTop: bandTop,
        textBlockHeight,
        footerSafeY: footerLimit,
        remainingBelowText: Math.max(0, footerLimit - (bandTop + textBlockHeight)),
      },
    };

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
