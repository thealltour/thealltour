import type { FlyerDraftState } from "@/lib/flyers/flyer.types";

/** 롱포맷 세로 문서용 간격 (모바일 스크롤 리듬) */
export type FlyerSpacingClasses = {
  inner: string;
  stackGap: string;
  mainStack: string;
  cardPad: string;
  /** 포함·불포함 카드만: 좌우·상하 소폭 (+2px / +4px 수준) */
  includedExcludedPadTweak: string;
  galleryGap: string;
  headerMb: string;
  /** `grid` 와 함께 사용: 예 `grid-cols-1 sm:grid-cols-2` */
  galleryGridClass: string;
};

export function getFlyerSpacing(draft: FlyerDraftState): FlyerSpacingClasses {
  const lo = draft.layoutOptions;
  const compress =
    lo.compactMode || lo.spacingMode === "tight" || draft.templateKey === "a4-portrait-compact";
  const denseGallery =
    lo.imageDensity === "compact" || draft.templateKey === "a4-portrait-compact";

  return {
    inner: compress ? "px-4 py-6 sm:px-5 sm:py-7" : "px-5 py-8 sm:px-8 sm:py-9",
    stackGap: compress ? "gap-5" : "gap-6",
    mainStack: compress ? "space-y-5" : "space-y-8",
    cardPad: compress ? "p-5 sm:p-6" : "p-6 sm:p-7",
    includedExcludedPadTweak: compress
      ? "max-sm:!px-[22px] !py-6 sm:!py-7"
      : "max-sm:!px-[26px] !py-7 sm:!py-8",
    galleryGap: denseGallery ? "gap-2.5" : "gap-3.5",
    headerMb: compress ? "mb-3 pb-2" : "mb-1 pb-1",
    galleryGridClass: denseGallery ? "grid-cols-2 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2",
  };
}

export function flyerTypographyScale(draft: FlyerDraftState): "normal" | "compact" {
  return draft.layoutOptions.compactMode ? "compact" : "normal";
}
