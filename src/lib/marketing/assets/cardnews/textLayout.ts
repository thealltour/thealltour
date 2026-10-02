/**
 * CardNews text measurement / wrapping / fit (v2.4 word-aware).
 */

import { CARDNEWS_SAFE } from "@/lib/marketing/assets/cardnews/brand";
import { CardNewsRenderOverflowError } from "@/lib/marketing/assets/errors";
import { TYPOGRAPHY_LINE_HEIGHT } from "@/lib/marketing/assets/cardnews/typographyTokens";

const HANGUL = /[\uAC00-\uD7A3]/u;
const graphemeSegmenter = new Intl.Segmenter("ko", { granularity: "grapheme" });
export function textGraphemes(text: string): string[] {
  return [...graphemeSegmenter.segment(text)].map((part) => part.segment);
}
export function isEmojiGrapheme(text: string): boolean {
  return !text.includes("\uFE0E") && /[\p{Extended_Pictographic}\p{Regional_Indicator}\u20e3]/u.test(text);
}

/** Render-only editorial breaks. URLs and non-Korean comma usages stay literal. */
export function normalizeCardnewsRenderText(text: string): string {
  return text.replace(/\r\n?/gu, "\n").replace(/\S+/gu, (token) => {
    if (/(?:[a-z][a-z0-9+.-]*:\/\/|www\.|mailto:|[a-z\d][\w.-]*\.[a-z]{2,}(?:[\/?#:]|$))/iu.test(token)) return token;
    return token.replace(/(?<=[\uAC00-\uD7A3]),(?=[\uAC00-\uD7A3])/gu, "\n");
  });
}

export type CardnewsTextField = "headline" | "body" | "kicker" | "microcopy";
/**
 * Latin + Vietnamese letters (incl. horn ư/ơ in Extended-B and precomposed tones).
 * Combining marks kept so NFD forms stay one token.
 */
const LATIN_LETTER_CLASS =
  "A-Za-zÀ-ÖØ-öø-ÿĀ-ſ\\u0180-\\u024FḀ-ỿ\\u0300-\\u036F";
const LATIN_WORD = new RegExp(
  `[${LATIN_LETTER_CLASS}]+(?:['’][${LATIN_LETTER_CLASS}]+)*`,
  "u",
);
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
  return textGraphemes(text).reduce((sum, cluster) => sum + (
    isEmojiGrapheme(cluster) ? fontSize * 1.25 : [...cluster].reduce((width, glyph) => width + measureGlyph(glyph, fontSize), 0)
  ), 0);
}

export function lineHeightFor(fontSize: number, role: CardnewsTextField = "body"): number {
  const mult = role === "headline" ? TYPOGRAPHY_LINE_HEIGHT.headline : TYPOGRAPHY_LINE_HEIGHT.body;
  return Math.round(fontSize * mult);
}

export type WrapTextResult = {
  lines: string[];
  /** True when at least one Latin/Viet/Hangul token was split at character level. */
  characterFallback: boolean;
  /** True when a transliteration pair (`Mẫu Sơn(머우선)`) was wider than a line and broke inside. */
  protectedPhraseSplit: boolean;
};

type Token = { text: string; breakable: boolean };

/**
 * Tokenize a paragraph for word-aware wrapping.
 * Keeps Latin/Vietnamese words and Hangul runs intact; spaces/punctuation are separate.
 */
export function tokenizeForWrap(paragraph: string): Token[] {
  const tokens: Token[] = [];
  const re = new RegExp(
    `(\\s+)|([${LATIN_LETTER_CLASS}]+(?:['’][${LATIN_LETTER_CLASS}]+)*)|([\\uAC00-\\uD7A3]+)|([^\\s${LATIN_LETTER_CLASS}\\uAC00-\\uD7A3]+)`,
    "gu",
  );
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

/** Marks that must not open a line — they ride on the preceding token. */
const LINE_START_FORBIDDEN = /^[)\]},.!?:;%’”」』…]/u;
/** Opening marks that must not close a line — they ride on the following token. */
const LINE_END_FORBIDDEN = /[([{‘“「『]$/u;

const LATIN_PHRASE = `[${LATIN_LETTER_CLASS}]+(?:['’][${LATIN_LETTER_CLASS}]+)*(?:[ \\u00A0][${LATIN_LETTER_CLASS}]+(?:['’][${LATIN_LETTER_CLASS}]+)*){0,3}`;
/**
 * Transliteration pairs wrapped as one unit while they fit a line: `Mẫu Sơn(머우선)`,
 * `Dao(자오)족`, `nhà trình tường(냐 찐 뜨엉)`, `랑선(Lạng Sơn)`. A Hangul run glued after the
 * closing paren (족, 에서 …) is the same eojeol.
 */
const PROTECTED_PHRASE = new RegExp(
  `(?<![${LATIN_LETTER_CLASS}\\uAC00-\\uD7A3])(?:${LATIN_PHRASE}|[\\uAC00-\\uD7A3]+) ?\\((?=[^()\\n]*[${LATIN_LETTER_CLASS}\\uAC00-\\uD7A3])[^()\\n]{1,24}\\)[\\uAC00-\\uD7A3]*`,
  "gu",
);

/** A Hangul run written flush after these is its particle/suffix (`)에서`, `Dao족`, `3일`). */
const HANGUL_SUFFIX_HOST = new RegExp(`[)\\]}’”」』0-9${LATIN_LETTER_CLASS}]$`, "u");

type WrapUnit = {
  text: string;
  space: boolean;
  /** "glue": members that must share a line; "phrase": [original, gloss] halves. */
  kind: "token" | "glue" | "phrase";
  /** Replayed in order when the unit alone is wider than a line. */
  children: WrapUnit[];
};

function glueUnits(atoms: WrapUnit[], hangulSuffix = true): WrapUnit[] {
  const out: WrapUnit[] = [];
  for (const atom of atoms) {
    const prev = out.at(-1);
    const glued =
      prev !== undefined &&
      !prev.space &&
      !atom.space &&
      (LINE_START_FORBIDDEN.test(atom.text) ||
        LINE_END_FORBIDDEN.test(prev.text) ||
        (hangulSuffix && HANGUL_SUFFIX_HOST.test(prev.text) && HANGUL.test(atom.text[0] ?? "")));
    if (!glued) {
      out.push(atom);
      continue;
    }
    out[out.length - 1] = {
      text: prev.text + atom.text,
      space: false,
      kind: "glue",
      children: prev.kind === "glue" ? [...prev.children, atom] : [prev, atom],
    };
  }
  return out;
}

function tokenUnits(text: string): WrapUnit[] {
  return tokenizeForWrap(text).map((token) => ({
    text: token.text,
    space: /^\s+$/u.test(token.text),
    kind: "token" as const,
    children: [],
  }));
}

/**
 * Members wrapped separately when a unit is wider than a line. Phrase halves and nested runs
 * open up first and are re-glued, so `(따이)족,` stays together; a plain token group first
 * drops only its Hangul-suffix glue (`(자오)|족과`), then replays its raw tokens.
 */
function fallbackUnits(unit: WrapUnit): WrapUnit[] {
  if (unit.kind !== "glue") return unit.children;
  if (unit.children.every((child) => child.kind === "token")) {
    const punctuationOnly = glueUnits(unit.children, false);
    return punctuationOnly.length > 1 ? punctuationOnly : unit.children;
  }
  const opened = glueUnits(
    unit.children.flatMap((child) => (child.kind === "token" ? [child] : child.children)),
  );
  return opened.length > 1 ? opened : unit.children;
}

function containsPhrase(unit: WrapUnit): boolean {
  return unit.kind === "phrase" || unit.children.some(containsPhrase);
}

function runUnit(text: string): WrapUnit {
  const children = glueUnits(tokenUnits(text));
  return children.length === 1 ? children[0]! : { text, space: false, kind: "glue", children };
}

/**
 * Group wrap tokens into units that must share a line. Only line-break positions change;
 * the concatenated unit text is always the original paragraph.
 */
function buildWrapUnits(paragraph: string): WrapUnit[] {
  const atoms: WrapUnit[] = [];
  let cursor = 0;
  for (const match of paragraph.matchAll(PROTECTED_PHRASE)) {
    atoms.push(...tokenUnits(paragraph.slice(cursor, match.index)));
    const paren = match[0].indexOf("(");
    atoms.push({
      text: match[0],
      space: false,
      kind: "phrase",
      children: [runUnit(match[0].slice(0, paren)), runUnit(match[0].slice(paren))],
    });
    cursor = match.index + match[0].length;
  }
  atoms.push(...tokenUnits(paragraph.slice(cursor)));
  return glueUnits(atoms);
}

/** A last headline line this short (visible glyphs) reads as a dangling fragment. */
const DANGLING_TAIL_MAX_GLYPHS = 2;

/**
 * Pull the previous line's last unit down onto a dangling last line. Never changes the line
 * count, only re-joins across a whitespace break, and never leaves the previous line narrower
 * than the new last line.
 */
function balanceDanglingTail(input: {
  lines: string[];
  spaceBreaks: boolean[];
  paragraphStart: number;
  fontSize: number;
  wrapWidth: number;
}): void {
  const { lines, spaceBreaks } = input;
  const last = lines.length - 1;
  if (last - input.paragraphStart < 1 || !spaceBreaks[last - 1]) return;
  const tail = lines[last]!;
  if ([...tail.replace(/\s+/gu, "")].length > DANGLING_TAIL_MAX_GLYPHS) return;
  const units = buildWrapUnits(lines[last - 1]!);
  const moved = units.at(-1);
  const gap = units.at(-2);
  if (!moved || moved.space || !gap?.space) return;
  const head = units
    .slice(0, -2)
    .map((unit) => unit.text)
    .join("")
    .replace(/\s+$/u, "");
  const nextTail = `${moved.text} ${tail}`;
  const nextTailWidth = measureTextWidth(nextTail, input.fontSize);
  if (!head || nextTailWidth > input.wrapWidth) return;
  if (measureTextWidth(head, input.fontSize) < nextTailWidth) return;
  lines[last - 1] = head;
  lines[last] = nextTail;
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
    new RegExp(
      `^([${LATIN_LETTER_CLASS}]+(?:['’][${LATIN_LETTER_CLASS}]+)*)([\\uAC00-\\uD7A3]+.*)$`,
      "u",
    ),
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
  for (const ch of textGraphemes(token)) {
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
 * Closing marks stay with the preceding token, opening marks with the following one, and
 * transliteration pairs stay whole while they fit a line.
 */
export function wrapTextDetailed(
  text: string,
  fontSize: number,
  maxWidth: number,
  options: { balanceDanglingTail?: boolean } = {},
): WrapTextResult {
  const paragraphs = normalizeCardnewsRenderText(text).split("\n");
  const lines: string[] = [];
  /** Per line: broke at whitespace, so the next line may be re-joined with a space. */
  const spaceBreaks: boolean[] = [];
  let characterFallback = false;
  let protectedPhraseSplit = false;
  const wrapWidth = maxWidth * 0.98;

  const pushLine = (line: string, spaceBreak: boolean) => {
    lines.push(line);
    spaceBreaks.push(spaceBreak);
  };

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      pushLine("", false);
      continue;
    }
    const paragraphStart = lines.length;
    let current = "";
    let currentWidth = 0;

    const flush = (spaceBreak: boolean) => {
      const trimmed = current.replace(/\s+$/u, "");
      if (trimmed.length > 0 || current.length > 0) {
        pushLine(trimmed, spaceBreak || trimmed.length < current.length);
      }
      current = "";
      currentWidth = 0;
    };

    /**
     * When a Latin/Viet word won't fit, pull the trailing Latin phrase
     * (e.g. "nhà trình") onto the next line with it → "nhà trình tường".
     */
    const pullTrailingLatinPhrase = (): string => {
      const re = new RegExp(
        `^(.*?)(\\s+[${LATIN_LETTER_CLASS}]+(?:\\s+[${LATIN_LETTER_CLASS}]+)*)\\s*$`,
        "u",
      );
      const m = current.match(re);
      if (!m || !m[1] || !m[1].trim()) return "";
      const head = m[1]!;
      const pulled = m[2]!.trimStart();
      if (!pulled) return "";
      pushLine(head.replace(/\s+$/u, ""), true);
      current = "";
      currentWidth = 0;
      return pulled;
    };

    const pushPiece = (piece: string, unit?: WrapUnit) => {
      const w = measureTextWidth(piece, fontSize);
      const members = unit && w > wrapWidth ? fallbackUnits(unit) : [];
      if (unit && members.length > 0) {
        protectedPhraseSplit = protectedPhraseSplit || containsPhrase(unit);
        // A unit wider than a whole line cannot stay together — wrap its members instead.
        for (const member of members) {
          if (member.space) pushToken(member.text);
          else pushPiece(member.text, member);
        }
        return;
      }
      if (currentWidth > 0 && currentWidth + w > wrapWidth && LINE_START_FORBIDDEN.test(piece)) {
        // Only reached when the word before the mark fills a line alone: carry its last Hangul
        // syllable down (same break the syllable fallback allows) instead of opening with the mark.
        const carried = /(?<=[\uAC00-\uD7A3])[\uAC00-\uD7A3]$/u.exec(current)?.[0];
        if (carried) {
          current = current.slice(0, -carried.length);
          flush(false);
          current = carried;
          currentWidth = measureTextWidth(carried, fontSize);
        }
      }
      if (currentWidth > 0 && currentWidth + w > wrapWidth) {
        let prefix = "";
        if (isLatinOrVietToken(piece)) {
          prefix = pullTrailingLatinPhrase();
        }
        if (!prefix) flush(false);
        if (prefix) {
          const combined = `${prefix} ${piece}`;
          const cw = measureTextWidth(combined, fontSize);
          if (cw <= wrapWidth) {
            current = combined;
            currentWidth = cw;
            return;
          }
          // Prefix alone on its line; piece continues.
          pushLine(prefix, true);
          current = "";
          currentWidth = 0;
        }
      }
      if (w > wrapWidth) {
        const split = splitOverlongToken(piece, fontSize, wrapWidth);
        characterFallback = characterFallback || split.characterFallback;
        if (currentWidth > 0) flush(false);
        for (const part of split.parts.slice(0, -1)) pushLine(part, false);
        // The last part stays open so a following closing mark can still attach to it.
        current = split.parts.at(-1) ?? "";
        currentWidth = measureTextWidth(current, fontSize);
        return;
      }
      current += piece;
      currentWidth += w;
    };

    const pushToken = (token: string) => {
      if (/^\s+$/u.test(token)) {
        // Prefer breaking at whitespace: if space doesn't fit, flush before it.
        const w = measureTextWidth(token, fontSize);
        if (currentWidth > 0 && currentWidth + w > wrapWidth) {
          flush(true);
          return; // drop leading space on new line
        }
        if (currentWidth === 0) return;
        current += token;
        currentWidth += w;
        return;
      }
      pushPiece(token);
    };

    for (const unit of buildWrapUnits(paragraph)) {
      if (unit.space) pushToken(unit.text);
      else pushPiece(unit.text, unit);
    }
    if (current.length > 0) flush(false);
    if (options.balanceDanglingTail) {
      balanceDanglingTail({ lines, spaceBreaks, paragraphStart, fontSize, wrapWidth });
    }
  }

  return { lines: lines.length > 0 ? lines : [""], characterFallback, protectedPhraseSplit };
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
  field: CardnewsTextField;
}): FittedText {
  const source = input.text;
  if (!source.trim()) {
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

  const safeMin = input.field === "headline" ? CARDNEWS_SAFE.minHeadlinePx
    : input.field === "body" ? CARDNEWS_SAFE.minBodyPx
    : input.field === "kicker" ? CARDNEWS_SAFE.minLabelPx : CARDNEWS_SAFE.minSourcePx;
  const effectiveMin = Math.max(input.minFontSize, safeMin);
  const startSize = Math.max(input.preferredFontSize, effectiveMin);
  const headline = input.field === "headline";
  /** Largest headline fit that had to break inside a transliteration pair. */
  let phraseSplitFit: FittedText | null = null;

  for (let fontSize = startSize; fontSize >= effectiveMin; fontSize -= 1) {
    const lineHeight = lineHeightFor(fontSize, input.field);
    const wrapped = wrapTextDetailed(source, fontSize, input.maxWidth, {
      balanceDanglingTail: headline,
    });
    const maxLines = Math.min(input.maxLines, Math.max(1, Math.floor(input.maxHeight / lineHeight)));
    if (wrapped.lines.length <= maxLines && wrapped.lines.length * lineHeight <= input.maxHeight) {
      const fitted: FittedText = {
        fontSize,
        lines: wrapped.lines,
        lineHeight,
        height: wrapped.lines.length * lineHeight,
        ellipsisApplied: false,
        fontShrunk: fontSize < input.preferredFontSize,
        characterFallback: wrapped.characterFallback,
      };
      // Headlines shrink further to keep a transliteration pair whole; body keeps its size.
      if (!headline || !wrapped.protectedPhraseSplit) return fitted;
      phraseSplitFit ??= fitted;
      if (fontSize === effectiveMin) return phraseSplitFit;
      continue;
    }
    if (fontSize === effectiveMin) {
      if (phraseSplitFit) return phraseSplitFit;
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
