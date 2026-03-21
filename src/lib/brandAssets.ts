/**
 * 승인 워드마크 — 라이트(흰 배경) / 다크(납품 다크 배경)
 *
 * `next/image` 캐시 회피: 자산 교체 시 파일명 버전(v5/v6…) 올리기.
 */
/** 치수 변경 시 `ThemedWordmarkImage.tsx` 내 `WORDMARK_INTRINSIC_*` 도 맞출 것 */
export const THEALL_WORDMARK_INTRINSIC_LIGHT = { width: 1024, height: 184 } as const;
export const THEALL_WORDMARK_INTRINSIC_DARK = { width: 1024, height: 189 } as const;

/** @deprecated 라이트와 동일 — 하위 호환 */
export const THEALL_WORDMARK_INTRINSIC = THEALL_WORDMARK_INTRINSIC_LIGHT;

export const THEALL_WORDMARK_LIGHT_SRC = "/thealltour-wordmark-light-v5.png" as const;
export const THEALL_WORDMARK_DARK_SRC = "/thealltour-wordmark-dark-v6.png" as const;

/** OG·JSON-LD·폴백 등 단일 URL이 필요할 때 — 라이트 자산 */
export const THEALL_WORDMARK_IMAGE_SRC = THEALL_WORDMARK_LIGHT_SRC;

/** 파비콘·앱 아이콘 (`public/favicon-*.png`, `apple-touch-icon.png`) */
export const THEALL_FAVICON_16_SRC = "/favicon-16.png" as const;
export const THEALL_FAVICON_32_SRC = "/favicon-32.png" as const;
export const THEALL_APPLE_TOUCH_ICON_SRC = "/apple-touch-icon.png" as const;
