/**
 * CardNews text measurement / wrapping / fit (v2.4 word-aware).
 */

import { CARDNEWS_SAFE } from "@/lib/marketing/assets/cardnews/brand";
import { CardNewsRenderOverflowError } from "@/lib/marketing/assets/errors";
import { TYPOGRAPHY_LINE_HEIGHT } from "@/lib/marketing/assets/cardnews/typographyTokens";

const HANGUL = /[\uAC00-\uD7A3]/u;
const LATIN_WORD =
  /[A-Za-zÀ-ÖØ-öø-ÿĀ-ſḀ-ỿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿĀ-ſḀ-ỿ]+)*/u;
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

export function lineHeightFor(fontSize: number, role: "headline" | "body" = "body"): number {
  const mult = role === "headline" ? TYPOGRAPHY_LINE_HEIGHT.headline : TYPOGRAPHY_LINE_HEIGHT.body;
  return Math.round(fontSize * mult);
}

export type WrapTextResult = {
  lines: string[];
  /** True when at least one Latin/Viet/Hangul token was split at character level. */
  characterFallback: boolean;
};

type Token = { text: string; breakable: boolean };

/**
 * Tokenize a paragraph for word-aware wrapping.
 * Keeps Latin/Vietnamese words and Hangul runs intact; spaces/punctuation are separate.
 */
export function tokenizeForWrap(paragraph: string): Token[] {
  const tokens: Token[] = [];
  const re =
    /(\s+)|([A-Za-zÀ-ÖØ-öø-ÿĀ-ſḀ-ỿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿĀ-ſḀ-ỿ]+)*)|([\uAC00-\uD7A3]+)|([^\sA-Za-zÀ-ÖØ-öø-ÿĀ-ſḀ-ỿ\uAC00-\uD7A3]+)/gu;
  let match: RegExpExecArray | null;
  while ((match = re.exec(paragraph)) !== null) {
    const text = match[0];
    if (!text) continue;
    if (match[1]) {
      tokens.push({ text, breakable: true });
    } else if (match[2] || match[3]) {
      tokens.push({ text, breakable: false });
    } else {
      // punctuation / symbols — prefer keep with previous word; allow break after
      tokens.push({ text, breakable: true });
    }
  }
  return tokens;
}

function isLatinOrVietToken(text: string): boolean {
  return LATIN_WORD.test(text) && !HANGUL.test(text);
}

function isHangulToken(text: string): boolean {
  return [...text].every((ch) => HANGUL.test(ch));
}

/**
 * Split an overlong atomic token. Prefer script boundary, then Hangul syllables,
 * then character fallback (flagged).
 */
export function splitOverlongToken(
  token: string,
  fontSize: number,
  maxWidth: number,
): { parts: string[]; characterFallback: boolean } {
  if (measureTextWidth(token, fontSize) <= maxWidth) {
    return { parts: [token], characterFallback: false };
  }

  // Script boundary: Latin/Viet then Hangul (e.g. Dao족)
  const scriptSplit = token.match(
    /^([A-Za-zÀ-ÖØ-öø-ÿĀ-ſḀ-ỿ]+(?:['’][A-Za-zÀ-ÖØ-öø-ÿĀ-ſḀ-ỿ]+)*)([\uAC00-\uD7A3]+.*)$/u,
  );
  if (scriptSplit) {
    const left = scriptSplit[1]!;
    const right = scriptSplit[2]!;
    if (measureTextWidth(left, fontSize) <= maxWidth) {
      const rest = splitOverlongToken(right, fontSize, maxWidth);
      return { parts: [left, ...rest.parts], characterFallback: rest.characterFallback };
    }
  }

  // Hangul: break by syllable (each Hangul syllable is a grapheme)
  if (isHangulToken(token)) {
    const parts: string[] = [];
    let current = "";
    for (const ch of [...token]) {
      const next = current + ch;
      if (current && measureTextWidth(next, fontSize) > maxWidth) {
        parts.push(current);
        current = ch;
      } else {
        current = next;
      }
    }
    if (current) parts.push(current);
    // Syllable breaks are preferred Korean fallback — not Latin character-split.
    return { parts, characterFallback: false };
  }

  // Latin/Viet or mixed: character-level last resort
  const parts: string[] = [];
  let current = "";
  for (const ch of [...token]) {
    const next = current + ch;
    if (current && measureTextWidth(next, fontSize) > maxWidth) {
      parts.push(current);
      current = ch;
    } else {
      current = next;
    }
  }
  if (current) parts.push(current);
  return { parts, characterFallback: true };
}

/**
 * Word-aware wrap: whitespace → punctuation → Hangul syllable → character fallback.
 */
export function wrapTextDetailed(text: string, fontSize: number, maxWidth: number): WrapTextResult {
  const paragraphs = text.replaceAll("\r\n", "\n").split("\n");
  const lines: string[] = [];
  let characterFallback = false;
  const wrapWidth = maxWidth * 0.98;

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      lines.push("");
      continue;
    }
    const tokens = tokenizeForWrap(paragraph);
    let current = "";
    let currentWidth = 0;

    const flush = () => {
      const trimmed = current.replace(/\s+$/u, "");
      if (trimmed.length > 0 || current.length > 0) {
        lines.push(trimmed);
      }
      current = "";
      currentWidth = 0;
    };

    const pushPiece = (piece: string) => {
      const w = measureTextWidth(piece, fontSize);
      if (currentWidth > 0 && currentWidth + w > wrapWidth) {
        flush();
      }
      if (w > wrapWidth) {
        const split = splitOverlongToken(piece, fontSize, wrapWidth);
        characterFallback = characterFallback || split.characterFallback;
        for (const part of split.parts) {
          if (currentWidth > 0) flush();
          lines.push(part);
        }
        current = "";
        currentWidth = 0;
        return;
      }
      current += piece;
      currentWidth += w;
    };

    for (const token of tokens) {
      if (/^\s+$/u.test(token.text)) {
        // Prefer breaking at whitespace: if space doesn't fit, flush before it.
        const w = measureTextWidth(token.text, fontSize);
        if (currentWidth > 0 && currentWidth + w > wrapWidth) {
          flush();
          continue; // drop leading space on new line
        }
        if (currentWidth === 0) continue;
        current += token.text;
        currentWidth += w;
        continue;
      }
      pushPiece(token.text);
    }
    if (current.length > 0) flush();
  }

  return { lines: lines.length > 0 ? lines : [""], characterFallback };
}

/** Back-compat: lines only. */
export function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  return wrapTextDetailed(text, fontSize, maxWidth).lines;
}

export type FittedText = {
  fontSize: number;
  lines: string[];
  lineHeight: number;
  height: number;
  ellipsisApplied: boolean;
  /** True when preferred font size was reduced to fit. */
  fontShrunk: boolean;
  /** True when wrap required character-level split of a protected token. */
  characterFallback: boolean;
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
      lineHeight: lineHeightFor(input.preferredFontSize, input.field),
      height: 0,
      ellipsisApplied: false,
      fontShrunk: false,
      characterFallback: false,
    };
  }

  const safeMin =
    input.field === "body" ? CARDNEWS_SAFE.minBodyPx : CARDNEWS_SAFE.minHeadlinePx;
  const effectiveMin = Math.max(input.minFontSize, safeMin);
  const startSize = Math.max(input.preferredFontSize, effectiveMin);

  for (let fontSize = startSize; fontSize >= effectiveMin; fontSize -= 1) {
    const lineHeight = lineHeightFor(fontSize, input.field);
    const wrapped = wrapTextDetailed(source, fontSize, input.maxWidth);
    const maxLines = Math.min(input.maxLines, Math.max(1, Math.floor(input.maxHeight / lineHeight)));
    if (wrapped.lines.length <= maxLines && wrapped.lines.length * lineHeight <= input.maxHeight) {
      return {
        fontSize,
        lines: wrapped.lines,
        lineHeight,
        height: wrapped.lines.length * lineHeight,
        ellipsisApplied: false,
        fontShrunk: fontSize < input.preferredFontSize,
        characterFallback: wrapped.characterFallback,
      };
    }
    if (fontSize === effectiveMin) {
      if (input.overflow === "ellipsis") {
        const clipped = wrapped.lines.slice(0, maxLines);
        if (clipped.length === 0) {
          throw new CardNewsRenderOverflowError({
            cardId: input.cardId,
            field: input.field,
            message: `CardNews ${input.field} on ${input.cardId} cannot fit at the minimum readable size`,
          });
        }
        const last = clipped[clipped.length - 1]!.replace(/…$/, "");
        clipped[clipped.length - 1] = `${last.replace(/[.,\s]+$/u, "")}…`;
        return {
          fontSize,
          lines: clipped,
          lineHeight,
          height: clipped.length * lineHeight,
          ellipsisApplied: true,
          fontShrunk: fontSize < input.preferredFontSize,
          characterFallback: wrapped.characterFallback,
        };
      }
      throw new CardNewsRenderOverflowError({
        cardId: input.cardId,
        field: input.field,
        message: `CardNews ${input.field} on ${input.cardId} overflows the canvas at the minimum readable size (${effectiveMin}px)`,
      });
    }
  }

  throw new CardNewsRenderOverflowError({
    cardId: input.cardId,
    field: input.field,
    message: `CardNews ${input.field} on ${input.cardId} cannot be laid out`,
  });
}

export { isLatinOrVietToken, isHangulToken };
