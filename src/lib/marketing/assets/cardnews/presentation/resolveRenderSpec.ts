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
  estimateGlyphBottom,
  estimateGlyphTop,
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

  const headline = fitText({
    text: input.card.headline,
    preferredFontSize: layout.text.headlinePreferred,
    minFontSize: CARDNEWS_SAFE.minHeadlinePx,
    maxWidth: layout.text.width,
    maxHeight: layout.text.maxHeadlineHeight,
    maxLines: maxLinesHeadline,
    overflow: "error",
    cardId: input.card.cardId,
    field: "headline",
  });

  const body = fitText({
    text: input.card.body,
    preferredFontSize: layout.text.bodyPreferred,
    minFontSize: CARDNEWS_SAFE.minBodyPx,
    maxWidth: layout.text.width,
    maxHeight: layout.text.maxBodyHeight,
    maxLines: maxLinesBody,
    overflow: input.card.role === "cta" ? "ellipsis" : "error",
    cardId: input.card.cardId,
    field: "body",
  });

  // Adjust line heights for mobile hierarchy
  if (layout.template === "cover_full_bleed" || layout.template === "text_statement") {
    headline.lineHeight = Math.round(headline.fontSize * 1.15);
    headline.height = headline.lines.length * headline.lineHeight;
  }
  body.lineHeight = Math.round(body.fontSize * 1.4);
  body.height = body.lines.length * body.lineHeight;

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
  };
}
