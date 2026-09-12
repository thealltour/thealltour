/**
 * Shared shortform narration splitting — excludes strategist outline headers
 * and derives visualIntent / purpose so stock search never falls back to "narration".
 */

import type { ShortformNarrationSegment } from "@/lib/marketing/assets/contracts";

const MAX_SEGMENTS = 16;

/** Strategist / Content Plan outline labels that must never become stock search subjects. */
const OUTLINE_HEADER_EXACT = new Set(
  [
    "context",
    "key verified facts from assignment evidence",
    "key verified facts",
    "travel relevance for audience",
    "travel relevance",
    "useful takeaway without product",
    "useful takeaway",
    "outline",
    "summary",
    "hook",
    "cta",
    "objective",
    "audience",
    "key message",
    "commercial intent",
    "facts",
    "evidence",
    "나레이션",
    "개요",
    "요약",
    "핵심 사실",
    "여행 관련성",
    "활용 포인트",
  ].map((s) => s.toLowerCase()),
);

const OUTLINE_HEADER_PREFIXES = [
  /^key verified facts\b/i,
  /^travel relevance\b/i,
  /^useful takeaway\b/i,
  /^assignment evidence\b/i,
  /^content plan\b/i,
  /^verified facts\b/i,
];

export type SplitShortformNarrationOptions = {
  destinations?: string[] | null;
  entities?: string[] | null;
  title?: string | null;
};

function hasHangul(text: string): boolean {
  return /[\uAC00-\uD7A3]/.test(text);
}

function looksLikeEnglishOutlineHeader(line: string): boolean {
  if (hasHangul(line)) return false;
  if (line.length > 80) return false;
  if (/[.!?。！？]/.test(line)) return false;
  // Short Title Case / label-like English lines without a real sentence body
  const words = line.split(/\s+/).filter(Boolean);
  if (words.length < 1 || words.length > 10) return false;
  const titleish = words.filter((w) => /^[A-Z][a-z0-9'-]*$/.test(w) || /^[A-Z0-9'-]+$/.test(w));
  return titleish.length >= Math.ceil(words.length * 0.6);
}

export function isOutlineHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (OUTLINE_HEADER_EXACT.has(lower)) return true;
  if (OUTLINE_HEADER_PREFIXES.some((re) => re.test(trimmed))) return true;
  if (looksLikeEnglishOutlineHeader(trimmed)) return true;
  return false;
}

function mentionedKnown(text: string, known: string[]): string | null {
  const haystack = text.toLowerCase();
  for (const item of known) {
    const needle = item.trim().toLowerCase();
    if (needle.length >= 2 && haystack.includes(needle)) return item.trim();
  }
  return null;
}

/**
 * Build a stock-search friendly visual subject from narration + destinations.
 */
export function deriveVisualIntent(input: {
  narrationText: string;
  destinations?: string[] | null;
  entities?: string[] | null;
  title?: string | null;
}): string {
  const destinations = (input.destinations ?? []).map((d) => d.trim()).filter(Boolean);
  const entities = (input.entities ?? []).map((e) => e.trim()).filter(Boolean);
  const narration = input.narrationText.trim();
  const mentionedDest = mentionedKnown(narration, destinations);
  const mentionedEntity = mentionedKnown(narration, entities);

  const pieces: string[] = [];
  if (mentionedDest) pieces.push(mentionedDest);
  else if (destinations[0]) pieces.push(destinations[0]);
  if (mentionedEntity && mentionedEntity !== mentionedDest) pieces.push(mentionedEntity);

  // Prefer a short concrete phrase from the narration body (not the whole paragraph).
  const sentence = narration.split(/[.!?。！？\n]/)[0]?.trim() || narration;
  const clipped = sentence.slice(0, 120).trim();
  if (clipped && !isOutlineHeaderLine(clipped)) {
    if (!pieces.some((p) => clipped.toLowerCase().includes(p.toLowerCase()))) {
      pieces.push(clipped);
    } else if (pieces.length === 0) {
      pieces.push(clipped);
    }
  }

  if (pieces.length === 0) {
    const title = input.title?.trim();
    if (title) pieces.push(title.slice(0, 120));
  }

  if (pieces.length === 0) return "travel lifestyle b-roll";

  return pieces.join(" · ").slice(0, 400);
}

function purposeForIndex(index: number, total: number): string {
  if (index === 0) return "hook";
  if (index === total - 1 && total > 1) return "close";
  return "body";
}

/**
 * Split draft body into shortform narration segments suitable for stock search.
 */
export function splitShortformNarrationSegments(
  body: string,
  options: SplitShortformNarrationOptions = {},
): ShortformNarrationSegment[] {
  const chunks = body
    .split(/\n{2,}|\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((line) => !isOutlineHeaderLine(line));

  const limited = chunks.slice(0, MAX_SEGMENTS);
  if (limited.length === 0) return [];

  return limited.map((text, index) => {
    const visualIntent = deriveVisualIntent({
      narrationText: text,
      destinations: options.destinations,
      entities: options.entities,
      title: options.title,
    });
    return {
      segmentId: `narr-${String(index + 1).padStart(2, "0")}`,
      narrationText: text.slice(0, 2000),
      subtitleText: text.slice(0, 2000),
      purpose: purposeForIndex(index, limited.length),
      visualIntent,
      evidenceRefs: [],
    };
  });
}
