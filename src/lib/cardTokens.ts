/**
 * 유저 페이지 공통 카드 시각 토큰.
 * 홈/목록/상세 카드·섹션에서 일관된 rounded, shadow, ring, hover, padding 사용.
 */

/** 카드 wrapper 기본: 배경·테두리·그림자·라운드 */
export const CARD_BASE =
  "rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-soft)]";

/** 카드 hover 시 강조 (링크/버튼 카드용) */
export const CARD_HOVER =
  "hover:border-[var(--border-strong)] hover:shadow-[var(--shadow-soft-strong)]";

/** 카드 전환 */
export const CARD_TRANSITION = "transition-all duration-200 ease-out";

/** 카드 내부 패딩 - 기본 */
export const CARD_PADDING = "p-4";

/** 카드 내부 패딩 - 여유 */
export const CARD_PADDING_RELAXED = "p-5";

/** 카드 이미지 영역 공통 */
export const CARD_IMAGE_WRAPPER = "relative w-full overflow-hidden";

/** 그리드 갭 - 카드 간격 */
export const CARD_GRID_GAP = "gap-4";

/** 그리드 갭 - 여유 */
export const CARD_GRID_GAP_RELAXED = "gap-6";
