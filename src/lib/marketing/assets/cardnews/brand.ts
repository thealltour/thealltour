/**
 * CardNews v0 colors mirror THEALL TOUR brand tokens in `src/app/globals.css`:
 * `--theall-brand-blue` / `--theall-brand-orange`. Do not introduce a second palette.
 */
export const CARDNEWS_RENDER_CONTRACT = "cardnews-render-v1" as const;
export const CARDNEWS_RENDERER_VERSION = "cardnews-render-v2.5-full-bleed-overlay-story" as const;

export const CARDNEWS_ASPECT_RATIOS = ["4:5", "1:1", "9:16"] as const;
export type CardNewsAspectRatio = (typeof CARDNEWS_ASPECT_RATIOS)[number];

export const CARDNEWS_SIZE_PRESETS: Record<
  CardNewsAspectRatio,
  { width: number; height: number }
> = {
  "4:5": { width: 1080, height: 1350 },
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
};

export const CARDNEWS_DEFAULT_ASPECT_RATIO: CardNewsAspectRatio = "4:5";

/** Every vertical anchor in the renderer was tuned on the 4:5 canvas. */
export const CARDNEWS_LAYOUT_BASE_HEIGHT = CARDNEWS_SIZE_PRESETS["4:5"].height;

export const CARDNEWS_WIDTH = CARDNEWS_SIZE_PRESETS["4:5"].width;
export const CARDNEWS_HEIGHT = CARDNEWS_SIZE_PRESETS["4:5"].height;
export const CARDNEWS_ASPECT_RATIO = CARDNEWS_DEFAULT_ASPECT_RATIO;
export const CARDNEWS_MEDIA_TYPE = "image/png" as const;

export type CardNewsGeometry = {
  aspectRatio: CardNewsAspectRatio;
  width: number;
  height: number;
  /** Maps a 4:5-tuned vertical anchor onto this canvas. Identity on 4:5. */
  scaleY: (base: number) => number;
};

export function isCardNewsAspectRatio(value: unknown): value is CardNewsAspectRatio {
  return CARDNEWS_ASPECT_RATIOS.includes(value as CardNewsAspectRatio);
}

export function resolveCardNewsGeometry(aspectRatio?: unknown): CardNewsGeometry {
  const ratio = isCardNewsAspectRatio(aspectRatio) ? aspectRatio : CARDNEWS_DEFAULT_ASPECT_RATIO;
  const preset = CARDNEWS_SIZE_PRESETS[ratio];
  const factor = preset.height / CARDNEWS_LAYOUT_BASE_HEIGHT;
  return {
    aspectRatio: ratio,
    width: preset.width,
    height: preset.height,
    scaleY: (base: number) => (factor === 1 ? base : Math.round(base * factor)),
  };
}

export const CARDNEWS_BRAND = {
  blue: "#1E5B8F",
  orange: "#FF7A2F",
  navy: "#0F172A",
  ink: "#1A2330",
  muted: "#5B6775",
  line: "#D7DEE6",
  paper: "#F7F9FB",
  white: "#FFFFFF",
} as const;

export const CARDNEWS_SAFE = {
  padX: 88,
  padY: 80,
  minHeadlinePx: 42,
  minBodyPx: 36,
  minLabelPx: 20,
  minSourcePx: 22,
} as const;

export const CARDNEWS_FONT_FAMILY = "Pretendard" as const;
export const CARDNEWS_WORDMARK_TEXT = "thealltour" as const;
export const CARDNEWS_WORDMARK_RELATIVE = "public/thealltour_logo_trp.png" as const;
