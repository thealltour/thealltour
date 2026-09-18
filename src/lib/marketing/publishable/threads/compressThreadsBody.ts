/**
 * Bounded Threads body compression — used before publishability failure when
 * the LLM exceeds THREADS_BODY_MAX_CHARS. Does not invent Story, checklist, or CTA.
 */

import {
  THREADS_BODY_MAX_CHARS,
  THREADS_BODY_PREFERRED_MAX_CHARS,
  THREADS_BODY_PREFERRED_MIN_CHARS,
} from "@/lib/marketing/publishable/validate";

const FORCED_DECISION_CTA_RE =
  /여러분은\s*.{0,40}(?:어느\s*쪽|어디가)\s*.{0,20}(?:끌리|좋으)|댓글로\s*(?:알려|남겨)|같이\s*골라\s*보|체크리스트로\s*정리/;

function normalizeWhitespace(body: string): string {
  return body
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function paragraphsOf(body: string): string[] {
  return body
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function joinParagraphs(parts: string[]): string {
  return parts.join("\n\n").trim();
}

function normalizeForCompare(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

/** Drop later paragraphs that largely repeat an earlier one. */
function removeDuplicateParagraphs(parts: string[]): string[] {
  const kept: string[] = [];
  const seen: string[] = [];
  for (const part of parts) {
    const key = normalizeForCompare(part);
    if (!key) continue;
    const isDup = seen.some((prev) => {
      if (prev === key) return true;
      if (prev.length >= 24 && key.includes(prev)) return true;
      if (key.length >= 24 && prev.includes(key)) return true;
      return false;
    });
    if (isDup) continue;
    kept.push(part);
    seen.push(key);
  }
  return kept;
}

function splitSentences(paragraph: string): string[] {
  const pieces = paragraph.split(/(?<=[.!?。…])\s+|(?<=다\.|요\.|죠\.|네요\.)\s+/);
  return pieces.map((s) => s.trim()).filter(Boolean);
}

/** Within each paragraph, drop consecutive near-duplicate sentences. */
function removeRepeatedSentences(parts: string[]): string[] {
  return parts.map((paragraph) => {
    const sentences = splitSentences(paragraph);
    if (sentences.length <= 1) return paragraph;
    const kept: string[] = [];
    for (const sentence of sentences) {
      const key = normalizeForCompare(sentence);
      const prev = kept[kept.length - 1];
      if (prev && normalizeForCompare(prev) === key) continue;
      if (prev && key.length >= 20 && normalizeForCompare(prev).includes(key)) continue;
      if (prev && normalizeForCompare(prev).length >= 20 && key.includes(normalizeForCompare(prev))) {
        continue;
      }
      kept.push(sentence);
    }
    return kept.join(" ");
  });
}

/**
 * Drop forced decision/checklist CTAs when over budget — never rewrite discovery
 * into a checklist. Story paragraphs stay.
 */
function dropForcedCtaParagraphs(parts: string[]): string[] {
  if (parts.length < 2) return parts;
  return parts.filter((part, index) => {
    if (index === 0) return true;
    if (FORCED_DECISION_CTA_RE.test(part)) return false;
    if (/^[0-9]+[.)]\s/.test(part.trim()) && part.length < 120) return false;
    return true;
  });
}

function isLowValuePadding(paragraph: string): boolean {
  const compact = paragraph.replace(/\s+/g, "");
  if (compact.length < 16) return false;
  return new Set(compact).size <= 2;
}

function dropTrailingPadding(parts: string[]): string[] {
  const next = [...parts];
  while (next.length > 1 && isLowValuePadding(next[next.length - 1]!)) {
    next.pop();
  }
  return next;
}

function trimTrailingParagraphs(parts: string[], maxChars: number): string[] {
  if (parts.length <= 1) return parts;
  let next = [...parts];
  while (next.length > 2 && joinParagraphs(next).length > maxChars) {
    next = next.slice(0, -1);
  }
  return next;
}

function truncateAtSentenceBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const sliced = text.slice(0, maxChars);
  const boundaries = [".", "。", "!", "?", "요.", "다.", "죠.", "네요."];
  let cut = -1;
  for (const boundary of boundaries) {
    const idx = sliced.lastIndexOf(boundary);
    if (idx > cut) cut = idx + boundary.length - 1;
  }
  // Prefer keeping at least ~60% of the budget so we don't gut the Story.
  const minKeep = Math.floor(maxChars * 0.6);
  if (cut >= minKeep) {
    return sliced.slice(0, cut + 1).trim();
  }
  const paraBreak = sliced.lastIndexOf("\n\n");
  if (paraBreak >= minKeep) {
    return sliced.slice(0, paraBreak).trim();
  }
  return sliced.trim();
}

/**
 * Compress an over-limit Threads body toward `maxChars` without inventing
 * checklist/decision CTAs or new Story claims.
 */
export function compressThreadsBodyToLimit(
  body: string,
  maxChars: number = THREADS_BODY_MAX_CHARS,
): string {
  let text = normalizeWhitespace(body);
  if (text.length <= maxChars) return text;

  // Over budget: repetition first, then drop forced decision CTAs / padding,
  // then trim. Do not early-return before CTA cleanup — discovery must not
  // keep a forced checklist/decision close that only survived via padding.
  let parts = removeDuplicateParagraphs(paragraphsOf(text));
  parts = removeRepeatedSentences(parts);
  parts = dropForcedCtaParagraphs(parts);
  parts = dropTrailingPadding(parts);
  text = joinParagraphs(parts);
  if (text.length <= maxChars) return text;

  parts = trimTrailingParagraphs(paragraphsOf(text), maxChars);
  text = joinParagraphs(parts);
  if (text.length <= maxChars) return text;

  return truncateAtSentenceBoundary(text, maxChars);
}

export function threadsLengthRepairHint(overBy: number, actualLength: number): string {
  return [
    `LENGTH REPAIR: body was ${actualLength}/${THREADS_BODY_MAX_CHARS} (${overBy} over).`,
    `Rewrite body to ≤${THREADS_BODY_MAX_CHARS} characters (preferred ${THREADS_BODY_PREFERRED_MIN_CHARS}–${THREADS_BODY_PREFERRED_MAX_CHARS}).`,
    "Remove repetition first. Keep the same Story, evidence boundary, and concrete detail.",
    "Do NOT convert discovery into a checklist or forced decision CTA.",
  ].join(" ");
}
