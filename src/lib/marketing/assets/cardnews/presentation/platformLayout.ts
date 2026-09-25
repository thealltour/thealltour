/**
 * Platform layout tokens for Instagram cardnews canvases.
 * Base values are tuned on 4:5 (1080×1350); callers apply geometry.scaleY.
 */

import type { CardNewsAspectRatio } from "@/lib/marketing/assets/cardnews/brand";

export type InstagramPlatformLayoutId = "instagram_4_5" | "instagram_1_1";

export type InstagramPlatformLayout = {
  id: InstagramPlatformLayoutId;
  /** Top edge inset before primary content (image or text). */
  topSafePx: number;
  /**
   * Bottom reserve for progress dots + wordmark breathing room.
   * Text / image must not enter this zone.
   */
  footerReservePx: number;
  /** Extra bottom reserve when a citation line is present. */
  citationReservePx: number;
};

/**
 * Centralized platform profiles — do not scatter magic bottom paddings per card.
 */
export const PLATFORM_LAYOUT = {
  instagram_4_5: {
    id: "instagram_4_5",
    topSafePx: 0,
    footerReservePx: 128,
    citationReservePx: 56,
  },
  instagram_1_1: {
    id: "instagram_1_1",
    // Same logical tokens; scaleY on 1:1 compresses vertical reserves.
    topSafePx: 0,
    footerReservePx: 128,
    citationReservePx: 56,
  },
} as const satisfies Record<InstagramPlatformLayoutId, InstagramPlatformLayout>;

export function resolvePlatformLayout(
  aspectRatio: CardNewsAspectRatio,
): InstagramPlatformLayout {
  if (aspectRatio === "1:1") return PLATFORM_LAYOUT.instagram_1_1;
  // 4:5 primary; 9:16 shortform is out of Instagram cardnews scope — fall back to 4:5 tokens.
  return PLATFORM_LAYOUT.instagram_4_5;
}
