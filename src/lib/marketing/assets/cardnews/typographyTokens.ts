/**
 * Mobile-readable typography tokens for Instagram cardnews (v2.6).
 * Tuned for Instagram mobile feed scale — not desktop 1080×1350 “looks fine”.
 *
 * v2.6: wider overlay text column + preferred size bump (~15–18% vs v2.5)
 * with cover/story body parity in the overlay family.
 */

import type { CardTextDensity } from "@/lib/marketing/assets/cardnews/presentation/contracts";
import type { CardNewsAspectRatio } from "@/lib/marketing/assets/cardnews/brand";

/** v2.3 baselines (for regression). */
export const TYPOGRAPHY_V23_BASELINE = {
  bodyPreferred: { compact: 30, standard: 34, minimal: 32 },
  headlinePreferredNonCover: { compact: 52, standard: 56, minimal: 58 },
  minBodyPx: 26,
  minHeadlinePx: 36,
} as const;

/** v2.5 preferred baselines (before wide-overlay bump). */
export const TYPOGRAPHY_V25_BASELINE = {
  headline: {
    story: { compact: 56, standard: 62, minimal: 66 },
    cover: { compact: 62, standard: 68, minimal: 72 },
  },
  body: {
    story: { compact: 42, standard: 48, minimal: 50 },
    /** Legacy cover compact body — removed for parity in v2.6. */
    cover: { compact: 40, standard: 44, minimal: 46 },
  },
  overlayTextWidth4x5: 920,
} as const;

/**
 * Preferred font sizes (4:5 canvas px).
 * Cover body shares story scale so card-01 stays mobile-readable with 02–04.
 */
export const TYPOGRAPHY_PREFERRED = {
  headline: {
    /** photo_top / evidence / overlay story */
    story: { compact: 64, standard: 70, minimal: 74 },
    /** cover may stay equal or slightly above story hero */
    cover: { compact: 68, standard: 72, minimal: 76 },
    statement: { compact: 72, standard: 76, minimal: 80 },
  },
  body: {
    story: { compact: 50, standard: 56, minimal: 58 },
    /** Parity with story — legacy compact cover body retired. */
    cover: { compact: 50, standard: 56, minimal: 58 },
    statement: { compact: 50, standard: 56, minimal: 58 },
  },
} as const;

/** Line-height multipliers. */
export const TYPOGRAPHY_LINE_HEIGHT = {
  headline: 1.18,
  body: 1.36,
  /** Cover overlay body uses same readable stack as story (v2.6 parity). */
  coverBody: 1.36,
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

/**
 * 1:1 uses the same family but slightly smaller preferred sizes so taller
 * 4:5 tokens do not overflow the shorter canvas.
 */
export const TYPOGRAPHY_FORMAT_SCALE: Record<CardNewsAspectRatio, number> = {
  "4:5": 1,
  "1:1": 0.9,
  "9:16": 1,
};

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

export function formatScaleForAspect(aspectRatio: CardNewsAspectRatio): number {
  return TYPOGRAPHY_FORMAT_SCALE[aspectRatio] ?? 1;
}
