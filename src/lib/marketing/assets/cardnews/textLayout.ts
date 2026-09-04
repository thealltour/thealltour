import { CARDNEWS_SAFE } from "@/lib/marketing/assets/cardnews/brand";
import { CardNewsRenderOverflowError } from "@/lib/marketing/assets/errors";

const CJK =
  /[\u1100-\u11FF\u3130-\u318F\uAC00-\uD7A3\u3000-\u303F\u3040-\u30FF\u3400-\u9FFF\uF900-\uFAFF]/u;

export function measureGlyph(glyph: string, fontSize: number): number {
  if (!glyph || glyph === "\n") return 0;
  if (glyph === " " || glyph === "\t") return fontSize * 0.32;
  if (CJK.test(glyph)) return fontSize;
  if (/[A-Z]/.test(glyph)) return fontSize * 0.68;
  if (/[0-9]/.test(glyph)) return fontSize * 0.62;
  return fontSize * 0.56;
}

export function measureTextWidth(text: string, fontSize: number): number {
  return [...text].reduce((sum, glyph) => sum + measureGlyph(glyph, fontSize), 0);
}

export function lineHeightFor(fontSize: number): number {
  return Math.round(fontSize * 1.38);
}

export function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const paragraphs = text.replaceAll("\r\n", "\n").split("\n");
  const lines: string[] = [];
  const wrapWidth = maxWidth * 0.98;
  for (const paragraph of paragraphs) {
    const glyphs = [...paragraph];
    if (glyphs.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    let currentWidth = 0;
    for (const glyph of glyphs) {
      const width = measureGlyph(glyph, fontSize);
      const isBreak = glyph === " ";
      if (currentWidth + width > wrapWidth && current.length > 0) {
        lines.push(current.trimEnd());
        current = isBreak ? "" : glyph;
        currentWidth = isBreak ? 0 : width;
        continue;
      }
      current += glyph;
      currentWidth += width;
    }
    if (current.length > 0) lines.push(current.trimEnd());
  }
  return lines.length > 0 ? lines : [""];
}

export type FittedText = {
  fontSize: number;
  lines: string[];
  lineHeight: number;
  height: number;
  ellipsisApplied: boolean;
};

export function fitText(input: {
  text: string;
  preferredFontSize: number;
  minFontSize: number;
  maxWidth: number;
  maxHeight: number;
  maxLines: number;
  overflow: "error" | "ellipsis";
  cardId: string;
  field: "headline" | "body";
}): FittedText {
  const source = input.text.trim();
  if (!source) {
    return {
      fontSize: input.preferredFontSize,
      lines: [],
      lineHeight: lineHeightFor(input.preferredFontSize),
      height: 0,
      ellipsisApplied: false,
    };
  }

  for (let fontSize = input.preferredFontSize; fontSize >= input.minFontSize; fontSize -= 1) {
    const lineHeight = lineHeightFor(fontSize);
    const wrapped = wrapText(source, fontSize, input.maxWidth);
    const maxLines = Math.min(input.maxLines, Math.max(1, Math.floor(input.maxHeight / lineHeight)));
    if (wrapped.length <= maxLines && wrapped.length * lineHeight <= input.maxHeight) {
      if (fontSize < CARDNEWS_SAFE.minBodyPx && input.field === "body") {
        continue;
      }
      if (fontSize < CARDNEWS_SAFE.minHeadlinePx && input.field === "headline") {
        continue;
      }
      return {
        fontSize,
        lines: wrapped,
        lineHeight,
        height: wrapped.length * lineHeight,
        ellipsisApplied: false,
      };
    }
    if (fontSize === input.minFontSize) {
      if (input.overflow === "ellipsis") {
        const clipped = wrapped.slice(0, maxLines);
        if (clipped.length === 0) {
          throw new CardNewsRenderOverflowError({
            cardId: input.cardId,
            field: input.field,
            message: `CardNews ${input.field} on ${input.cardId} cannot fit at the minimum readable size`,
          });
        }
        const last = clipped[clipped.length - 1].replace(/…$/, "");
        clipped[clipped.length - 1] = `${last.replace(/[.,\s]+$/u, "")}…`;
        return {
          fontSize,
          lines: clipped,
          lineHeight,
          height: clipped.length * lineHeight,
          ellipsisApplied: true,
        };
      }
      throw new CardNewsRenderOverflowError({
        cardId: input.cardId,
        field: input.field,
        message: `CardNews ${input.field} on ${input.cardId} overflows the canvas at the minimum readable size (${input.minFontSize}px)`,
      });
    }
  }

  throw new CardNewsRenderOverflowError({
    cardId: input.cardId,
    field: input.field,
    message: `CardNews ${input.field} on ${input.cardId} cannot be laid out`,
  });
}
