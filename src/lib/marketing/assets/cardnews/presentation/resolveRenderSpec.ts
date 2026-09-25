/**
 * Merge editorial card + presentation + visual → ResolvedCardRenderSpec.
 * Renderer executes this spec only — no further editorial decisions.
 *
 * `role` / card index are internal presentation metadata — never user-facing copy.
 * `kicker` is optional explicit editorial copy only (no role-derived fallback).
 */

import type { CardNewsCard, CardNewsRole } from "@/lib/marketing/assets/contracts";
import type { CardNewsGeometry } from "@/lib/marketing/assets/cardnews/brand";
import type { FittedText } from "@/lib/marketing/assets/cardnews/textLayout";
import { fitText } from "@/lib/marketing/assets/cardnews/textLayout";
import { CARDNEWS_SAFE } from "@/lib/marketing/assets/cardnews/brand";
import type { CardPresentation } from "@/lib/marketing/assets/cardnews/presentation/contracts";
import {
  densityHeadlineBodyGapPx,
  estimateGlyphBottom,
  estimateGlyphTop,
  footerSafeTextBottom,
  MIN_IMAGE_TEXT_BAND_GAP_PX,
  normalizeBandTextPlacement,
  placeMeasuredBlockInBand,
  resolveTemplateLayout,
  type ResolvedTemplateLayout,
} from "@/lib/marketing/assets/cardnews/presentation/templateGeometry";
import type { CardCitation } from "@/lib/marketing/assets/cardnews/svg";

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
  /** Density-aware gap between headline block and body first baseline. */
  headlineBodyGapPx: number;
};

const KICKER_FONT_PX = 20;

const BAND_PLACEMENT_TEMPLATES = new Set([
  "photo_top_story",
  "evidence_detail",
  "closing_insight",
]);

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

/**
 * After text is fitted, honor plan textPlacement inside the image→footer band.
 * cover_full_bleed / overlay / photo_bottom / text_statement keep provisional geometry.
 */
export function applyMeasuredTextPlacement(input: {
  layout: ResolvedTemplateLayout;
  geometry: CardNewsGeometry;
  kicker: string;
  headline: FittedText;
  body: FittedText;
  headlineBodyGapPx: number;
}): ResolvedTemplateLayout {
  const { layout, geometry, kicker, headline, body, headlineBodyGapPx } = input;
  if (!BAND_PLACEMENT_TEMPLATES.has(layout.template)) return layout;

  const firstTop = kicker
    ? estimateGlyphTop(layout.text.kickerY, KICKER_FONT_PX)
    : estimateGlyphTop(layout.text.y, headline.fontSize);

  let lastBottom: number;
  if (body.lines.length > 0) {
    const bodyBaseline =
      layout.text.y + (headline.lines.length ? headline.height + headlineBodyGapPx : 0);
    const lastBaseline =
      bodyBaseline + Math.max(0, body.lines.length - 1) * body.lineHeight;
    lastBottom = estimateGlyphBottom(lastBaseline, body.fontSize);
  } else if (headline.lines.length > 0) {
    const lastBaseline =
      layout.text.y + Math.max(0, headline.lines.length - 1) * headline.lineHeight;
    lastBottom = estimateGlyphBottom(lastBaseline, headline.fontSize);
  } else {
    lastBottom = firstTop;
  }

  const blockHeight = Math.max(0, lastBottom - firstTop);

  let availableTop: number;
  if (layout.image) {
    availableTop =
      layout.image.y + layout.image.height + geometry.scaleY(MIN_IMAGE_TEXT_BAND_GAP_PX);
  } else if (layout.template === "closing_insight") {
    availableTop = geometry.scaleY(kicker ? 400 : 280);
  } else {
    return layout;
  }

  const availableBottom = footerSafeTextBottom(geometry);
  if (availableBottom <= availableTop) return layout;

  const placement = normalizeBandTextPlacement(layout.textPlacement);
  const newFirstTop = placeMeasuredBlockInBand({
    availableTop,
    availableBottom,
    blockHeight,
    placement,
  });
  const delta = newFirstTop - firstTop;
  if (Math.abs(delta) < 0.5) return layout;

  return {
    ...layout,
    text: {
      ...layout.text,
      y: layout.text.y + delta,
      kickerY: layout.text.kickerY + delta,
    },
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
  const layoutProvisional = resolveTemplateLayout({
    presentation: input.presentation,
    geometry: input.geometry,
    hasVisual,
    roleHint: input.card.role,
    hasKicker: Boolean(explicitKicker),
  });

  const maxLinesHeadline =
    layoutProvisional.template === "cover_full_bleed" ||
    layoutProvisional.template === "text_statement"
      ? 3
      : 4;
  const maxLinesBody = layoutProvisional.template === "closing_insight" ? 5 : 6;

  const headline = fitText({
    text: input.card.headline,
    preferredFontSize: layoutProvisional.text.headlinePreferred,
    minFontSize: CARDNEWS_SAFE.minHeadlinePx,
    maxWidth: layoutProvisional.text.width,
    maxHeight: layoutProvisional.text.maxHeadlineHeight,
    maxLines: maxLinesHeadline,
    overflow: "error",
    cardId: input.card.cardId,
    field: "headline",
  });

  const body = fitText({
    text: input.card.body,
    preferredFontSize: layoutProvisional.text.bodyPreferred,
    minFontSize: CARDNEWS_SAFE.minBodyPx,
    maxWidth: layoutProvisional.text.width,
    maxHeight: layoutProvisional.text.maxBodyHeight,
    maxLines: maxLinesBody,
    overflow: input.card.role === "cta" ? "ellipsis" : "error",
    cardId: input.card.cardId,
    field: "body",
  });

  // Adjust line heights for mobile hierarchy
  if (
    layoutProvisional.template === "cover_full_bleed" ||
    layoutProvisional.template === "text_statement"
  ) {
    headline.lineHeight = Math.round(headline.fontSize * 1.15);
    headline.height = headline.lines.length * headline.lineHeight;
  }
  body.lineHeight = Math.round(body.fontSize * 1.4);
  body.height = body.lines.length * body.lineHeight;

  const kicker = kickerSafeForHeadline(explicitKicker, layoutProvisional, headline.fontSize);
  // cover / overlay keep legacy 36px gap so card-01 golden geometry stays pixel-stable.
  // Band templates (photo_top / evidence / closing) use density-aware spacing.
  const headlineBodyGapPx =
    layoutProvisional.template === "cover_full_bleed" ||
    layoutProvisional.template === "photo_overlay_editorial"
      ? input.geometry.scaleY(36)
      : densityHeadlineBodyGapPx(layoutProvisional.textDensity, input.geometry);
  const layout = applyMeasuredTextPlacement({
    layout: layoutProvisional,
    geometry: input.geometry,
    kicker,
    headline,
    body,
    headlineBodyGapPx,
  });

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
