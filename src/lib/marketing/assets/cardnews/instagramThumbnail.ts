/**
 * Instagram 1:1 thumbnail variant of the first card: the operator's thumbnail title alone,
 * centered in a profile-grid safe area over the first card's visual. Independent of the
 * cover_full_bleed lower-band composition so normal cards never change.
 */

import {
  CARDNEWS_BRAND,
  CARDNEWS_FONT_FAMILY,
  type CardNewsGeometry,
} from "@/lib/marketing/assets/cardnews/brand";
import { escapeXml } from "@/lib/marketing/assets/cardnews/svg";
import { fitText, measureGlyph, type FittedText } from "@/lib/marketing/assets/cardnews/textLayout";

export const INSTAGRAM_THUMBNAIL_VARIANT = "instagram_thumbnail" as const;
export type CardNewsRenderVariant = typeof INSTAGRAM_THUMBNAIL_VARIANT;

/** Fractions of the canvas kept free of title glyphs (grid crop + profile UI). */
export const INSTAGRAM_THUMBNAIL_SAFE_AREA = {
  left: 0.15,
  right: 0.15,
  top: 0.1,
  bottom: 0.15,
} as const;

const TITLE_MAX_LINES = 3;
const TITLE_MAX_FONT_PX = 160;
const TITLE_MIN_FONT_PX = 44;
const LINE_START_FORBIDDEN = /^[,.!?:;)\]}」』…·%]/u;

export type InstagramThumbnailSafeRect = { x: number; y: number; width: number; height: number };

export function resolveInstagramThumbnailSafeRect(geo: CardNewsGeometry): InstagramThumbnailSafeRect {
  const left = Math.round(geo.width * INSTAGRAM_THUMBNAIL_SAFE_AREA.left);
  const right = Math.round(geo.width * INSTAGRAM_THUMBNAIL_SAFE_AREA.right);
  const top = Math.round(geo.height * INSTAGRAM_THUMBNAIL_SAFE_AREA.top);
  const bottom = Math.round(geo.height * INSTAGRAM_THUMBNAIL_SAFE_AREA.bottom);
  return { x: left, y: top, width: geo.width - left - right, height: geo.height - top - bottom };
}

export function fitInstagramThumbnailTitle(input: {
  title: string;
  cardId: string;
  safe: InstagramThumbnailSafeRect;
}): FittedText {
  const fit = (maxWidth: number, preferredFontSize: number) =>
    fitText({
      text: input.title,
      preferredFontSize,
      minFontSize: TITLE_MIN_FONT_PX,
      maxWidth,
      maxHeight: input.safe.height,
      maxLines: TITLE_MAX_LINES,
      overflow: "ellipsis",
      cardId: input.cardId,
      field: "headline",
    });
  let fitted = fit(input.safe.width, TITLE_MAX_FONT_PX);
  // One large title makes a wrapped "," / "." at a line start stand out; step down until it clears.
  while (
    fitted.fontSize > TITLE_MIN_FONT_PX &&
    fitted.lines.slice(1).some((line) => LINE_START_FORBIDDEN.test(line))
  ) {
    fitted = fit(input.safe.width, fitted.fontSize - 1);
  }
  if (!fitted.ellipsisApplied) return fitted;
  // The appended "…" is not measured by the wrap; reserve its width so the last line stays inside.
  return fit(input.safe.width - Math.ceil(measureGlyph("…", fitted.fontSize)), fitted.fontSize);
}

export type InstagramThumbnailSpec = {
  cardId: string;
  title: FittedText;
  safe: InstagramThumbnailSafeRect;
  visualDataUri: string | null;
  /** Same crop policy as the normal first card on this canvas. */
  preserveAspectRatio: string;
};

export function buildInstagramThumbnailSpec(input: {
  cardId: string;
  title: string;
  visualDataUri: string | null;
  preserveAspectRatio: string;
  geometry: CardNewsGeometry;
}): InstagramThumbnailSpec {
  const safe = resolveInstagramThumbnailSafeRect(input.geometry);
  return {
    cardId: input.cardId,
    title: fitInstagramThumbnailTitle({ title: input.title, cardId: input.cardId, safe }),
    safe,
    visualDataUri: input.visualDataUri,
    preserveAspectRatio: input.preserveAspectRatio,
  };
}

/** Baselines for a vertically centered block; glyph box ≈ 0.8em above baseline for Pretendard. */
export function instagramThumbnailBaselines(spec: InstagramThumbnailSpec): number[] {
  const { title, safe } = spec;
  const blockTop = safe.y + (safe.height - title.height) / 2;
  const firstBaseline = blockTop + (title.lineHeight - title.fontSize) / 2 + title.fontSize * 0.8;
  return title.lines.map((_, index) => Math.round(firstBaseline + index * title.lineHeight));
}

export function buildInstagramThumbnailSvg(spec: InstagramThumbnailSpec, geo: CardNewsGeometry): string {
  const clipId = `thumb-${escapeXml(spec.cardId)}`;
  const centerX = Math.round(spec.safe.x + spec.safe.width / 2);
  const baselines = instagramThumbnailBaselines(spec);
  const visual = spec.visualDataUri
    ? [
        `<clipPath id="${clipId}"><rect x="0" y="0" width="${geo.width}" height="${geo.height}"/></clipPath>`,
        `<image href="${spec.visualDataUri}" x="0" y="0" width="${geo.width}" height="${geo.height}" clip-path="url(#${clipId})" preserveAspectRatio="${spec.preserveAspectRatio}"/>`,
        `<rect width="${geo.width}" height="${geo.height}" fill="rgba(8,12,20,0.48)"/>`,
      ].join("")
    : "";
  const tspans = spec.title.lines
    .map((line, index) => `<tspan x="${centerX}" y="${baselines[index]}">${escapeXml(line)}</tspan>`)
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${geo.width}" height="${geo.height}" viewBox="0 0 ${geo.width} ${geo.height}">
  <rect width="${geo.width}" height="${geo.height}" fill="${CARDNEWS_BRAND.navy}"/>
  ${visual}
  <text text-anchor="middle" font-family="${CARDNEWS_FONT_FAMILY}" font-size="${spec.title.fontSize}" font-weight="700" fill="${CARDNEWS_BRAND.white}" style="filter:drop-shadow(0 3px 10px rgba(8,12,20,0.68))">${tspans}</text>
</svg>`;
}
