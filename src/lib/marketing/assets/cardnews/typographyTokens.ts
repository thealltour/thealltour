/**
 * Mobile-readable typography tokens for Instagram cardnews (v2.4).
 * Tuned for Instagram mobile feed scale — not desktop 1080×1350 “looks fine”.
 */

import type { CardTextDensity } from "@/lib/marketing/assets/cardnews/presentation/contracts";

/** v2.3 baselines (for regression). */
export const TYPOGRAPHY_V23_BASELINE = {
  bodyPreferred: { compact: 30, standard: 34, minimal: 32 },
  headlinePreferredNonCover: { compact: 52, standard: 56, minimal: 58 },
  minBodyPx: 26,
  minHeadlinePx: 36,
} as const;

/**
 * Preferred font sizes (4:5 canvas px).
 * Body is intentionally close to headline so mobile feed remains readable.
 */
export const TYPOGRAPHY_PREFERRED = {
  headline: {
    /** photo_top / evidence / default */
    story: { compact: 56, standard: 62, minimal: 66 },
    cover: { compact: 62, standard: 68, minimal: 72 },
    statement: { compact: 68, standard: 74, minimal: 78 },
  },
  body: {
    story: { compact: 42, standard: 48, minimal: 50 },
    cover: { compact: 40, standard: 44, minimal: 46 },
    statement: { compact: 44, standard: 48, minimal: 50 },
  },
} as const;

/** Line-height multipliers. */
export const TYPOGRAPHY_LINE_HEIGHT = {
  headline: 1.18,
  body: 1.36,
  coverBody: 1.3,
} as const;

/** Headline↔body gap (4:5 base px) — hierarchy via spacing, not only size. */
export const TYPOGRAPHY_HEADLINE_BODY_GAP = {
  compact: 22,
  standard: 28,
  minimal: 32,
} as const satisfies Record<CardTextDensity, number>;

/** Font weights. */
export const TYPOGRAPHY_WEIGHT = {
  headline: 700,
  body: 500,
} as const;

/**
 * Body fill on paper cards — slightly darker than legacy muted for mobile contrast.
 * Cover/overlay still uses translucent white from template fills.
 */
export const TYPOGRAPHY_BODY_FILL_PAPER = "#3A4554" as const;

export function preferredHeadlinePx(
  density: CardTextDensity,
  kind: "story" | "cover" | "statement",
): number {
  return TYPOGRAPHY_PREFERRED.headline[kind][density];
}

export function preferredBodyPx(
  density: CardTextDensity,
  kind: "story" | "cover" | "statement",
): number {
  return TYPOGRAPHY_PREFERRED.body[kind][density];
}
