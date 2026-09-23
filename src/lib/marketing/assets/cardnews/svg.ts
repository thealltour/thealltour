/**
 * Template-driven CardNews SVG renderer (PR2).
 * Executes ResolvedCardRenderSpec only — no editorial decisions.
 * Removes the legacy fixed 904×300 image strip as primary path.
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { CardNewsRole } from "@/lib/marketing/assets/contracts";
import {
  CARDNEWS_BRAND,
  CARDNEWS_FONT_FAMILY,
  CARDNEWS_WORDMARK_RELATIVE,
  CARDNEWS_WORDMARK_TEXT,
  resolveCardNewsGeometry,
  type CardNewsGeometry,
} from "@/lib/marketing/assets/cardnews/brand";
import type { FittedText } from "@/lib/marketing/assets/cardnews/textLayout";
import {
  buildDeterministicCardPresentationPlan,
  legacyRoleToPresentationHint,
} from "@/lib/marketing/assets/cardnews/presentation/deterministic";
import type { ResolvedCardRenderSpec } from "@/lib/marketing/assets/cardnews/presentation/resolveRenderSpec";
import { resolveTemplateLayout, type ResolvedTemplateLayout } from "@/lib/marketing/assets/cardnews/presentation/templateGeometry";

export type CardCitation = {
  label: string;
  detail: string;
};

/** @deprecated Prefer ResolvedCardRenderSpec — kept for transitional callers. */
export type CardRenderModel = {
  cardId: string;
  role: CardNewsRole;
  index: number;
  total: number;
  kicker: string;
  headline: FittedText;
  body: FittedText;
  citation: CardCitation | null;
  visualDataUri: string | null;
  wordmarkDataUri: string | null;
  layout?: ResolvedTemplateLayout;
  presentation?: ResolvedCardRenderSpec["presentation"];
};

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function textBlock(input: {
  lines: string[];
  x: number;
  y: number;
  fontSize: number;
  lineHeight: number;
  weight: 400 | 700;
  fill: string;
}): string {
  if (input.lines.length === 0) return "";
  const tspans = input.lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : input.lineHeight;
      return `<tspan x="${input.x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");
  return `<text x="${input.x}" y="${input.y}" font-family="${CARDNEWS_FONT_FAMILY}" font-size="${input.fontSize}" font-weight="${input.weight}" fill="${input.fill}">${tspans}</text>`;
}

function wordmark(
  model: Pick<ResolvedCardRenderSpec, "wordmarkDataUri">,
  placement: ResolvedTemplateLayout["brand"]["wordmark"],
): string {
  const opacity = placement.opacity;
  if (model.wordmarkDataUri) {
    return `<image href="${model.wordmarkDataUri}" x="${placement.x}" y="${placement.y}" width="${placement.width}" height="${placement.height}" opacity="${opacity}" preserveAspectRatio="xMinYMid meet"/>`;
  }
  return `<text x="${placement.x}" y="${placement.y + 24}" font-family="${CARDNEWS_FONT_FAMILY}" font-size="22" font-weight="700" fill="${CARDNEWS_BRAND.blue}" fill-opacity="${opacity}">${escapeXml(CARDNEWS_WORDMARK_TEXT)}</text>`;
}

function progress(index: number, total: number, y: number, x: number): string {
  return Array.from({ length: total }, (_, offset) => {
    const cx = x + 8 + offset * 18;
    const fill = offset + 1 === index ? CARDNEWS_BRAND.blue : "rgba(0,0,0,0.12)";
    return `<circle cx="${cx}" cy="${y}" r="4" fill="${fill}"/>`;
  }).join("");
}

/** Subtle editorial accent for text_statement — bars only, never behind headline. */
function textStatementAccent(geo: CardNewsGeometry, y: number): string {
  return [
    `<rect x="80" y="${y}" width="56" height="5" fill="${CARDNEWS_BRAND.blue}"/>`,
    `<rect x="80" y="${y + 12}" width="28" height="5" fill="${CARDNEWS_BRAND.orange}" fill-opacity="0.85"/>`,
  ].join("");
}

/**
 * Opaque paper band under the text zone for split photo templates so no
 * image/decor bleeds behind headline/kicker glyphs.
 */
function textZoneBackdrop(
  layout: ResolvedTemplateLayout,
  geo: CardNewsGeometry,
): string {
  if (
    layout.template === "cover_full_bleed" ||
    layout.template === "photo_overlay_editorial" ||
    layout.text.fill === "transparent"
  ) {
    return "";
  }
  if (layout.template === "photo_top_story" && layout.image) {
    const y = layout.image.y + layout.image.height;
    return `<rect x="0" y="${y}" width="${geo.width}" height="${geo.height - y}" fill="${CARDNEWS_BRAND.paper}"/>`;
  }
  if (layout.template === "evidence_detail" && layout.image) {
    const y = layout.image.y + layout.image.height;
    return `<rect x="0" y="${y}" width="${geo.width}" height="${geo.height - y}" fill="${CARDNEWS_BRAND.paper}"/>`;
  }
  if (layout.template === "photo_bottom_story" && layout.image) {
    return `<rect x="0" y="0" width="${geo.width}" height="${layout.image.y}" fill="${CARDNEWS_BRAND.paper}"/>`;
  }
  return "";
}

function overlayGradient(
  cardId: string,
  overlay: NonNullable<ResolvedTemplateLayout["overlay"]>,
  width: number,
): string {
  if (overlay.mode === "none") return "";
  const dark = overlay.mode === "gradient_dark";
  const id = `ov-${escapeXml(cardId)}`;
  const c0 = dark ? "rgba(10,16,24,0)" : "rgba(255,255,255,0)";
  const c1 = dark ? "rgba(10,16,24,0.78)" : "rgba(255,255,255,0.82)";
  return [
    `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">`,
    `<stop offset="0%" stop-color="${c0}"/>`,
    `<stop offset="55%" stop-color="${c1}"/>`,
    `<stop offset="100%" stop-color="${c1}"/>`,
    `</linearGradient></defs>`,
    `<rect x="0" y="${overlay.y}" width="${width}" height="${overlay.height}" fill="url(#${id})"/>`,
  ].join("");
}

function visualSlot(
  cardId: string,
  dataUri: string,
  image: NonNullable<ResolvedTemplateLayout["image"]>,
  preserveAspectRatio: string,
): string {
  const clipId = `visual-${escapeXml(cardId)}`;
  return [
    `<clipPath id="${clipId}"><rect x="${image.x}" y="${image.y}" width="${image.width}" height="${image.height}" rx="${image.rx}"/></clipPath>`,
    `<image href="${dataUri}" x="${image.x}" y="${image.y}" width="${image.width}" height="${image.height}" clip-path="url(#${clipId})" preserveAspectRatio="${preserveAspectRatio}"/>`,
  ].join("");
}

export function loadWordmarkDataUri(repoRoot = process.cwd()): string | null {
  const absolute = join(repoRoot, CARDNEWS_WORDMARK_RELATIVE);
  if (!existsSync(absolute)) return null;
  const png = readFileSync(absolute);
  return `data:image/png;base64,${png.toString("base64")}`;
}

export function buildCardNewsSvgFromSpec(
  spec: ResolvedCardRenderSpec,
  geometry?: CardNewsGeometry,
): string {
  const geo = geometry ?? resolveCardNewsGeometry();
  const layout = spec.layout;
  const hasVisual = Boolean(spec.visualDataUri) && layout.image != null;

  const headlineY = layout.text.y;
  const bodyY = headlineY + (spec.headline.lines.length ? spec.headline.height + 36 : 0);

  // Accent sits above the headline (and above kicker when present).
  const accentY =
    layout.template === "text_statement"
      ? Math.max(
          28,
          (spec.kicker ? layout.text.kickerY : layout.text.y) -
            Math.round((spec.kicker ? 20 : spec.headline.fontSize) * 0.82) -
            geo.scaleY(36),
        )
      : 0;

  const citation =
    spec.citation && layout.template !== "cover_full_bleed"
      ? [
          `<text x="${layout.text.x}" y="${geo.height - geo.scaleY(140)}" font-family="${CARDNEWS_FONT_FAMILY}" font-size="18" font-weight="700" fill="${CARDNEWS_BRAND.blue}">${escapeXml(spec.citation.label)}</text>`,
          `<text x="${layout.text.x}" y="${geo.height - geo.scaleY(112)}" font-family="${CARDNEWS_FONT_FAMILY}" font-size="18" font-weight="400" fill="${CARDNEWS_BRAND.muted}">${escapeXml(spec.citation.detail)}</text>`,
        ].join("")
      : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${geo.width}" height="${geo.height}" viewBox="0 0 ${geo.width} ${geo.height}">
  <rect width="${geo.width}" height="${geo.height}" fill="${layout.text.fill === "transparent" ? CARDNEWS_BRAND.navy : CARDNEWS_BRAND.paper}"/>
  ${layout.brand.showTopBar ? `<rect width="${geo.width}" height="12" fill="${CARDNEWS_BRAND.blue}"/>` : ""}
  ${layout.brand.showBottomAccent ? `<rect x="0" y="${geo.height - 12}" width="${geo.width}" height="12" fill="${CARDNEWS_BRAND.orange}"/>` : ""}
  ${hasVisual && layout.image && spec.visualDataUri ? visualSlot(spec.cardId, spec.visualDataUri, layout.image, layout.preserveAspectRatio) : ""}
  ${textZoneBackdrop(layout, geo)}
  ${layout.overlay ? overlayGradient(spec.cardId, layout.overlay, geo.width) : ""}
  ${layout.template === "text_statement" ? textStatementAccent(geo, accentY) : ""}
  ${spec.kicker ? `<text x="${layout.text.x}" y="${layout.text.kickerY}" font-family="${CARDNEWS_FONT_FAMILY}" font-size="20" font-weight="700" fill="${layout.text.kickerFill}">${escapeXml(spec.kicker)}</text>` : ""}
  ${textBlock({
    lines: spec.headline.lines,
    x: layout.text.x,
    y: headlineY,
    fontSize: spec.headline.fontSize,
    lineHeight: spec.headline.lineHeight,
    weight: 700,
    fill: layout.text.headlineFill,
  })}
  ${textBlock({
    lines: spec.body.lines,
    x: layout.text.x,
    y: bodyY,
    fontSize: spec.body.fontSize,
    lineHeight: spec.body.lineHeight,
    weight: 400,
    fill: layout.text.bodyFill,
  })}
  ${citation}
  ${progress(spec.index, spec.total, layout.brand.progressY, layout.text.x)}
  ${wordmark(spec, layout.brand.wordmark)}
</svg>
`;
}

/**
 * Back-compat entry: if model already carries layout, use template path;
 * otherwise callers must migrate to buildCardNewsSvgFromSpec.
 */
export function buildCardNewsSvg(model: CardRenderModel, geometry?: CardNewsGeometry): string {
  if (model.layout && model.presentation) {
    return buildCardNewsSvgFromSpec(
      {
        cardId: model.cardId,
        role: model.role,
        index: model.index,
        total: model.total,
        kicker: model.kicker,
        headline: model.headline,
        body: model.body,
        citation: model.citation,
        visualDataUri: model.visualDataUri,
        wordmarkDataUri: model.wordmarkDataUri,
        presentation: model.presentation,
        layout: model.layout,
      },
      geometry,
    );
  }
  // Emergency: build a minimal photo_top / text_statement without presentation plan
  const geo = geometry ?? resolveCardNewsGeometry();
  const hasVisual = Boolean(model.visualDataUri);
  const plan = buildDeterministicCardPresentationPlan({
    assetId: "legacy",
    assetVersion: 0,
    sourceInstagramFingerprint: "legacy",
    cards: [
      {
        cardId: model.cardId,
        role: legacyRoleToPresentationHint(model.role),
        hasVisual,
      },
    ],
  });
  const presentation = plan.cards[0]!;
  const layout = resolveTemplateLayout({ presentation, geometry: geo, hasVisual });
  return buildCardNewsSvgFromSpec(
    {
      ...model,
      presentation,
      layout,
    },
    geo,
  );
}
