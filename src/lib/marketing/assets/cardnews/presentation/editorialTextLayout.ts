import { CARDNEWS_SAFE } from "@/lib/marketing/assets/cardnews/brand";
import { fitText, type CardnewsTextField, type FittedText } from "@/lib/marketing/assets/cardnews/textLayout";
import { CardNewsRenderOverflowError } from "@/lib/marketing/assets/errors";
import { formatScaleForAspect } from "@/lib/marketing/assets/cardnews/typographyTokens";
import type { BuildCardRenderSpecInput, ResolvedCardRenderSpec } from "./resolveRenderSpec";
import { allocateClosingTextBand, allocateImageBackedBand, headlineBodyGapForDensity, imageRatioBoundsForTemplate, IMAGE_TEXT_GAP } from "./contentAwareLayout";
import { resolvePlatformLayout } from "./platformLayout";
import { estimateGlyphTop, resolveTemplateLayout } from "./templateGeometry";

type TextStack = Record<CardnewsTextField, FittedText> & {
  height: number;
  kickerY: number;
  headlineY: number;
  microcopyY: number;
};

/** Relative baselines, shared with SVG stacking. Empty blocks contribute no gap or height. */
function positionStack(fields: Record<CardnewsTextField, FittedText>, gap: number): TextStack {
  let bottom = 0;
  let previous: CardnewsTextField | null = null;
  const positions = { kickerY: 0, headlineY: 0, microcopyY: 0 };
  for (const field of ["kicker", "headline", "body", "microcopy"] as const) {
    const text = fields[field];
    if (!text.lines.length) continue;
    const separation = !previous ? 0 : previous === "kicker" ? 32 : field === "microcopy" ? 18 : gap;
    // Headline/body retain the established baseline-to-baseline spacing.
    const baseline = previous === "headline" && field === "body"
      ? positions.headlineY + fields.headline.height + separation
      : bottom + separation + Math.round(text.fontSize * 0.82);
    if (field === "kicker") positions.kickerY = baseline;
    if (field === "headline" || (field === "body" && !fields.headline.lines.length)) positions.headlineY = baseline;
    if (field === "microcopy") positions.microcopyY = baseline;
    bottom = baseline + (text.lines.length - 1) * text.lineHeight + Math.round(text.fontSize * 0.22);
    previous = field;
  }
  return { ...fields, ...positions, height: bottom };
}

/** Measure complete copy before allocating space; no per-field six-line probe or truncation. */
function fitStack(input: BuildCardRenderSpecInput, width: number, headlinePx: number, bodyPx: number, budget: number, gap: number): TextStack {
  const source = {
    kicker: input.editorialKicker ?? "",
    headline: input.card.headline,
    body: input.card.body,
    microcopy: input.editorialMicrocopy ?? "",
  };
  const fit = (field: CardnewsTextField, size: number) => {
    const text = fitText({
      text: source[field], preferredFontSize: size, minFontSize: size,
      maxWidth: width, maxHeight: 100_000, maxLines: 10_000,
      overflow: "error", cardId: input.card.cardId, field,
    });
    if (field === "headline" && (input.presentation.template === "cover_full_bleed" || input.presentation.template === "text_statement")) {
      text.lineHeight = Math.round(text.fontSize * 1.15);
      text.height = text.lines.length * text.lineHeight;
    }
    return text;
  };
  let headlineSize = Math.max(headlinePx, CARDNEWS_SAFE.minHeadlinePx);
  let bodySize = Math.max(bodyPx, CARDNEWS_SAFE.minBodyPx);
  while (true) {
    const stack = positionStack({
      kicker: fit("kicker", 20), headline: fit("headline", headlineSize),
      body: fit("body", bodySize), microcopy: fit("microcopy", 24),
    }, gap);
    if (stack.height <= budget) {
      stack.headline.fontShrunk = stack.headline.fontSize < headlinePx;
      stack.body.fontShrunk = stack.body.fontSize < bodyPx;
      return stack;
    }
    if (source.body.trim() && bodySize > CARDNEWS_SAFE.minBodyPx) bodySize -= 1;
    else if (source.headline.trim() && headlineSize > CARDNEWS_SAFE.minHeadlinePx) headlineSize -= 1;
    else {
      const field = (["body", "headline", "microcopy", "kicker"] as const)
        .reduce((largest, current) => stack[current].height > stack[largest].height ? current : largest, "body");
      throw new CardNewsRenderOverflowError({
        cardId: input.card.cardId, field,
        message: `CardNews ${field} on ${input.card.cardId} cannot fit the complete text stack (${stack.height}px > ${Math.floor(budget)}px) at readable minimum sizes`,
      });
    }
  }
}

/** All templates consume the same four-field fitter; image and footer remain protected. */
export function buildEditorialTextSpec(input: BuildCardRenderSpecInput): ResolvedCardRenderSpec {
  const geo = input.geometry;
  const hasKicker = Boolean(input.editorialKicker?.trim());
  const layout = resolveTemplateLayout({
    presentation: input.presentation, geometry: geo,
    hasVisual: Boolean(input.visualDataUri), roleHint: input.card.role, hasKicker,
  });
  const gap = headlineBodyGapForDensity(layout.textDensity, geo);
  const platform = resolvePlatformLayout(geo.aspectRatio);
  const overlay = layout.template === "cover_full_bleed" || layout.template === "photo_overlay_editorial";
  const closing = layout.template === "closing_insight";
  const imageBacked = layout.image && (layout.template === "photo_top_story" || layout.template === "evidence_detail");
  const scale = overlay ? formatScaleForAspect(geo.aspectRatio) : 1;
  const headlinePx = Math.round(layout.text.headlinePreferred * scale);
  const bodyPx = Math.round(layout.text.bodyPreferred * scale);
  let top: number;
  let footer: number;
  let stack: TextStack;

  if (overlay) {
    const cover = layout.template === "cover_full_bleed";
    footer = geo.height - geo.scaleY(48);
    const preferredTop = geo.height - geo.scaleY(hasKicker ? (cover ? 380 : 400) : cover ? 340 : 360) + geo.scaleY(hasKicker ? 28 : 40);
    const normalTop = geo.scaleY(cover ? 420 : 380);
    // Dense reviewed copy may expand above the lower third, below the existing wordmark.
    const safeTop = Math.max(geo.scaleY(platform.topSafePx), layout.brand.wordmark.y + layout.brand.wordmark.height + geo.scaleY(36));
    let minTop = normalTop;
    try {
      stack = fitStack(input, layout.text.width, headlinePx, bodyPx, footer - minTop, gap);
    } catch (error) {
      if (!(error instanceof CardNewsRenderOverflowError)) throw error;
      minTop = safeTop;
      stack = fitStack(input, layout.text.width, headlinePx, bodyPx, footer - minTop, gap);
    }
    top = Math.max(minTop, Math.min(preferredTop, footer - stack.height));
    layout.overlay = {
      mode: layout.overlay?.mode ?? "gradient_dark",
      y: Math.max(0, top - geo.scaleY(cover ? 48 : 72)),
      height: geo.height - Math.max(0, top - geo.scaleY(cover ? 48 : 72)),
    };
  } else if (imageBacked) {
    const template = layout.template as "photo_top_story" | "evidence_detail";
    const bounds = imageRatioBoundsForTemplate(template, input.presentation.imageHeightRatio)!;
    footer = geo.height - geo.scaleY(platform.footerReservePx) - (input.citation ? geo.scaleY(platform.citationReservePx) : 0);
    const imageTop = template === "evidence_detail" ? geo.scaleY(80) : geo.scaleY(platform.topSafePx);
    stack = fitStack(input, layout.text.width, headlinePx, bodyPx,
      footer - imageTop - Math.round(geo.height * bounds.min) - geo.scaleY(IMAGE_TEXT_GAP.min), gap);
    const allocation = allocateImageBackedBand({
      geometry: geo, template, preferredImageRatio: input.presentation.imageHeightRatio,
      textBlockHeight: stack.height, headlineFontPx: stack.headline.fontSize, hasKicker,
      hasCitation: Boolean(input.citation),
    });
    layout.image = allocation.image;
    top = allocation.textBandTop;
    layout.contentAware = allocation.metrics;
  } else if (layout.template === "photo_bottom_story" && layout.image) {
    top = Math.max(geo.scaleY(platform.topSafePx), estimateGlyphTop(hasKicker ? layout.text.kickerY : layout.text.y, hasKicker ? 20 : headlinePx));
    footer = layout.image.y - geo.scaleY(IMAGE_TEXT_GAP.min);
    stack = fitStack(input, layout.text.width, headlinePx, bodyPx, footer - top, gap);
  } else {
    const closingPlatform = closing ? {
      ...platform, footerReservePx: 220,
      // Keep the fixed-size editorial accent above even a dense closing stack.
      topSafePx: Math.max(platform.topSafePx, 96 + 17 * 1350 / geo.height),
    } : platform;
    footer = geo.height - geo.scaleY(closingPlatform.footerReservePx) - (!closing && input.citation ? geo.scaleY(platform.citationReservePx) : 0);
    stack = fitStack(input, layout.text.width, headlinePx, bodyPx, footer - geo.scaleY(Math.max(closingPlatform.topSafePx, 48)), gap);
    const allocation = allocateClosingTextBand({
      geometry: geo, textBlockHeight: stack.height, headlineFontPx: stack.headline.fontSize,
      hasKicker, textPlacement: input.presentation.textPlacement,
      platform: { ...closingPlatform, footerReservePx: closingPlatform.footerReservePx + (!closing && input.citation ? platform.citationReservePx : 0) },
    });
    top = allocation.textBandTop;
    if (closing) {
      // Match the established brand-signature closing footer.
      layout.brand = {
        wordmark: { x: 80, y: geo.height - geo.scaleY(156), width: 340, height: 58, opacity: 0.95 },
        progressY: geo.height - geo.scaleY(48), showTopBar: true, showBottomAccent: true,
        signatureRule: { x: 80, y: geo.height - geo.scaleY(186), width: 112, height: 2 },
        showEditorialAccent: true, editorialAccentY: geo.scaleY(72),
      };
    }
  }

  layout.text.y = top + stack.headlineY;
  layout.text.kickerY = top + stack.kickerY;
  layout.contentAware = {
    ...layout.contentAware, textBandTop: top, textBlockHeight: stack.height,
    footerSafeY: footer, remainingBelowText: Math.max(0, footer - top - stack.height),
  };
  // This is a final invariant, rather than silently deleting an editorial field.
  const lastText = stack.microcopy.lines.length ? stack.microcopy : stack.body.lines.length ? stack.body : stack.headline;
  if (top + stack.height > footer || top + stack.height > geo.height) {
    throw new CardNewsRenderOverflowError({ cardId: input.card.cardId, field: lastText === stack.microcopy ? "microcopy" : "body", message: "CardNews text exceeds the safe footer" });
  }
  return {
    cardId: input.card.cardId, role: input.card.role, index: input.index, total: input.total,
    kicker: input.editorialKicker?.trim() ?? "", kickerText: stack.kicker,
    headline: stack.headline, body: stack.body, microcopy: stack.microcopy,
    microcopyY: top + stack.microcopyY,
    citation: input.citation, visualDataUri: input.visualDataUri, wordmarkDataUri: input.wordmarkDataUri,
    presentation: input.presentation, layout, headlineBodyGapPx: gap,
  };
}
