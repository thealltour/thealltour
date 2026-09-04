/**
 * CardNews v0 colors mirror THEALL TOUR brand tokens in `src/app/globals.css`:
 * `--theall-brand-blue` / `--theall-brand-orange`. Do not introduce a second palette.
 */
export const CARDNEWS_RENDER_CONTRACT = "cardnews-render-v1" as const;
export const CARDNEWS_RENDERER_VERSION = "cardnews-render-v1" as const;

export const CARDNEWS_WIDTH = 1080 as const;
export const CARDNEWS_HEIGHT = 1350 as const;
export const CARDNEWS_ASPECT_RATIO = "4:5" as const;
export const CARDNEWS_MEDIA_TYPE = "image/png" as const;

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
  minHeadlinePx: 36,
  minBodyPx: 26,
  minLabelPx: 20,
  minSourcePx: 22,
} as const;

export const CARDNEWS_FONT_FAMILY = "Pretendard" as const;
export const CARDNEWS_WORDMARK_TEXT = "thealltour" as const;
export const CARDNEWS_WORDMARK_RELATIVE = "public/thealltour_logo_trp.png" as const;
