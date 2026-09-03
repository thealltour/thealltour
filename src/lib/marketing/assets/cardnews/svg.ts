import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import type { CardNewsRole } from "@/lib/marketing/assets/contracts";
import {
  CARDNEWS_BRAND,
  CARDNEWS_FONT_FAMILY,
  CARDNEWS_HEIGHT,
  CARDNEWS_SAFE,
  CARDNEWS_WIDTH,
  CARDNEWS_WORDMARK_RELATIVE,
  CARDNEWS_WORDMARK_TEXT,
} from "@/lib/marketing/assets/cardnews/brand";
import type { FittedText } from "@/lib/marketing/assets/cardnews/textLayout";

export type CardCitation = {
  label: string;
  detail: string;
};

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

function wordmark(model: CardRenderModel, x: number, y: number): string {
  if (model.wordmarkDataUri) {
    return `<image href="${model.wordmarkDataUri}" x="${x}" y="${y}" width="320" height="58" preserveAspectRatio="xMinYMid meet"/>`;
  }
  return `<text x="${x}" y="${y + 36}" font-family="${CARDNEWS_FONT_FAMILY}" font-size="28" font-weight="700" fill="${CARDNEWS_BRAND.blue}">${escapeXml(CARDNEWS_WORDMARK_TEXT)}</text>`;
}

function progress(model: CardRenderModel, y: number): string {
  const startX = CARDNEWS_SAFE.padX;
  return model.index
    ? Array.from({ length: model.total }, (_, offset) => {
        const cx = startX + 10 + offset * 22;
        const fill = offset + 1 === model.index ? CARDNEWS_BRAND.blue : CARDNEWS_BRAND.line;
        return `<circle cx="${cx}" cy="${y}" r="5" fill="${fill}"/>`;
      }).join("")
    : "";
}

function geometricFallback(role: CardNewsRole, index: number): string {
  const numeral = String(index).padStart(2, "0");
  const accent =
    role === "cta"
      ? `<rect x="${CARDNEWS_WIDTH - 196}" y="96" width="108" height="18" fill="${CARDNEWS_BRAND.orange}"/>`
      : `<rect x="${CARDNEWS_WIDTH - 176}" y="96" width="88" height="18" fill="${CARDNEWS_BRAND.blue}"/>`;
  return [
    `<text x="${CARDNEWS_SAFE.padX}" y="430" font-family="${CARDNEWS_FONT_FAMILY}" font-size="188" font-weight="700" fill="${CARDNEWS_BRAND.blue}" fill-opacity="0.08">${numeral}</text>`,
    `<rect x="${CARDNEWS_SAFE.padX}" y="96" width="72" height="72" fill="${CARDNEWS_BRAND.blue}"/>`,
    `<rect x="${CARDNEWS_SAFE.padX + 54}" y="132" width="36" height="36" fill="${CARDNEWS_BRAND.orange}"/>`,
    accent,
    `<rect x="${CARDNEWS_SAFE.padX}" y="184" width="160" height="4" fill="${CARDNEWS_BRAND.blue}"/>`,
  ].join("");
}

function visualSlot(model: CardRenderModel, x: number, y: number, width: number, height: number): string {
  if (!model.visualDataUri) return "";
  return [
    `<clipPath id="visual-${escapeXml(model.cardId)}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="8"/></clipPath>`,
    `<image href="${model.visualDataUri}" x="${x}" y="${y}" width="${width}" height="${height}" clip-path="url(#visual-${escapeXml(model.cardId)})" preserveAspectRatio="xMidYMid slice"/>`,
  ].join("");
}

export function loadWordmarkDataUri(repoRoot = process.cwd()): string | null {
  const absolute = join(repoRoot, CARDNEWS_WORDMARK_RELATIVE);
  if (!existsSync(absolute)) return null;
  const png = readFileSync(absolute);
  return `data:image/png;base64,${png.toString("base64")}`;
}

export function buildCardNewsSvg(model: CardRenderModel): string {
  const hasVisual = Boolean(model.visualDataUri);
  const contentTop = hasVisual ? 620 : 470;
  const headlineY = contentTop;
  const bodyY = headlineY + model.headline.height + 36;
  const citationY = CARDNEWS_HEIGHT - 210;
  const kickerFill = model.role === "cta" ? CARDNEWS_BRAND.orange : CARDNEWS_BRAND.blue;
  const kickerY = hasVisual ? 236 : 250;

  const citation = model.citation
    ? [
        `<rect x="${CARDNEWS_SAFE.padX}" y="${citationY - 28}" width="${CARDNEWS_WIDTH - CARDNEWS_SAFE.padX * 2}" height="4" fill="${CARDNEWS_BRAND.line}"/>`,
        `<text x="${CARDNEWS_SAFE.padX}" y="${citationY + 16}" font-family="${CARDNEWS_FONT_FAMILY}" font-size="20" font-weight="700" fill="${CARDNEWS_BRAND.blue}">${escapeXml(model.citation.label)}</text>`,
        `<text x="${CARDNEWS_SAFE.padX}" y="${citationY + 48}" font-family="${CARDNEWS_FONT_FAMILY}" font-size="22" font-weight="400" fill="${CARDNEWS_BRAND.muted}">${escapeXml(model.citation.detail)}</text>`,
      ].join("")
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${CARDNEWS_WIDTH}" height="${CARDNEWS_HEIGHT}" viewBox="0 0 ${CARDNEWS_WIDTH} ${CARDNEWS_HEIGHT}">
  <rect width="${CARDNEWS_WIDTH}" height="${CARDNEWS_HEIGHT}" fill="${CARDNEWS_BRAND.paper}"/>
  <rect width="${CARDNEWS_WIDTH}" height="18" fill="${CARDNEWS_BRAND.blue}"/>
  ${model.role === "cta" ? `<rect x="0" y="${CARDNEWS_HEIGHT - 18}" width="${CARDNEWS_WIDTH}" height="18" fill="${CARDNEWS_BRAND.orange}"/>` : ""}
  ${hasVisual ? "" : geometricFallback(model.role, model.index)}
  ${visualSlot(model, CARDNEWS_SAFE.padX, 280, CARDNEWS_WIDTH - CARDNEWS_SAFE.padX * 2, 300)}
  <text x="${CARDNEWS_SAFE.padX}" y="${kickerY}" font-family="${CARDNEWS_FONT_FAMILY}" font-size="22" font-weight="700" fill="${kickerFill}">${escapeXml(model.kicker)}</text>
  ${textBlock({
    lines: model.headline.lines,
    x: CARDNEWS_SAFE.padX,
    y: headlineY,
    fontSize: model.headline.fontSize,
    lineHeight: model.headline.lineHeight,
    weight: 700,
    fill: CARDNEWS_BRAND.ink,
  })}
  ${textBlock({
    lines: model.body.lines,
    x: CARDNEWS_SAFE.padX,
    y: bodyY,
    fontSize: model.body.fontSize,
    lineHeight: model.body.lineHeight,
    weight: 400,
    fill: CARDNEWS_BRAND.ink,
  })}
  ${citation}
  ${progress(model, CARDNEWS_HEIGHT - 118)}
  ${wordmark(model, CARDNEWS_SAFE.padX, CARDNEWS_HEIGHT - 96)}
</svg>
`;
}
