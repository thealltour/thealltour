/**
 * 승인 워드마크 — 라이트(투명 PNG) / 다크(납품 다크 배경)
 *
 * `next/image` 캐시 회피: 자산 교체 시 파일명·버전을 바꾸기.
 */
/** 치수 변경 시 `ThemedWordmarkImage.tsx` 내 `WORDMARK_INTRINSIC_*` 도 맞출 것 */
export const THEALL_WORDMARK_INTRINSIC_LIGHT = { width: 1024, height: 184 } as const;
export const THEALL_WORDMARK_INTRINSIC_DARK = { width: 1024, height: 189 } as const;

/** @deprecated 라이트와 동일 — 하위 호환 */
export const THEALL_WORDMARK_INTRINSIC = THEALL_WORDMARK_INTRINSIC_LIGHT;

/** 공개 헤더·글래스 위용 투명 워드마크 (`public/thealltour_logo_trp.png`) */
export const THEALL_WORDMARK_LIGHT_SRC = "/thealltour_logo_trp.png" as const;
export const THEALL_WORDMARK_DARK_SRC = "/thealltour-wordmark-dark-v6.png" as const;

/** OG·JSON-LD·폴백 등 단일 URL이 필요할 때 — 라이트 자산 */
export const THEALL_WORDMARK_IMAGE_SRC = THEALL_WORDMARK_LIGHT_SRC;

/**
 * 파비콘·앱 아이콘 — 브라우저·크롤러가 기대하는 표준 경로 (`public/` 루트).
 * 소스 자산은 `favicon-*-v2.png` 등으로 두고, 배포 시 동일 내용을 `favicon-16.png` 등으로 복사해 둠.
 */
export const THEALL_FAVICON_16_SRC = "/favicon-16.png" as const;
export const THEALL_FAVICON_32_SRC = "/favicon-32.png" as const;
export const THEALL_APPLE_TOUCH_ICON_SRC = "/apple-touch-icon.png" as const;
