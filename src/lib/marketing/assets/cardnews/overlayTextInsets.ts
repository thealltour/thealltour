/**
 * Overlay-family text column insets (cover_full_bleed + photo_overlay_editorial).
 *
 * v2.5 used symmetric 80/80 → maxWidth 920 on 1080.
 * v2.6 keeps left alignment near the prior inset and shortens the right safe
 * inset so the column widens without going full-bleed or kissing the edge.
 *
 * ~10–18% width growth is not safe with a real right margin on 1080;
 * 80/40 → 960 is ~+4.3% column growth; typography bump fills remaining dead space.
 */

export const OVERLAY_TEXT_INSETS = {
  /** Keep left alignment near v2.5. */
  left: 80,
  /** Narrower than left — still a visible safe margin. */
  right: 40,
} as const;

/** Paper / non-overlay templates keep the classic symmetric margin. */
export const PAPER_TEXT_INSETS = {
  left: 80,
  right: 80,
} as const;

export function overlayTextMaxWidth(canvasWidth: number): number {
  return canvasWidth - OVERLAY_TEXT_INSETS.left - OVERLAY_TEXT_INSETS.right;
}

export function paperTextMaxWidth(canvasWidth: number): number {
  return canvasWidth - PAPER_TEXT_INSETS.left - PAPER_TEXT_INSETS.right;
}
