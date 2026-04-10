import type { FlyerDraftState } from "@/lib/flyers/flyer.types";

/** 롱포맷 세로 문서용 간격 (모바일 스크롤 리듬) */
export type FlyerSpacingClasses = {
  inner: string;
  stackGap: string;
  mainStack: string;
  cardPad: string;
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
    inner: compress ? "px-4 py-4 sm:px-5" : "px-5 py-6 sm:px-7 sm:py-8",
    stackGap: compress ? "gap-3.5" : "gap-5",
    mainStack: compress ? "space-y-3.5" : "space-y-6",
    cardPad: compress ? "p-3.5" : "p-[1.125rem] sm:p-5",
    galleryGap: denseGallery ? "gap-2" : "gap-3",
    headerMb: compress ? "mb-3 pb-2" : "mb-1 pb-1",
    galleryGridClass: denseGallery ? "grid-cols-2 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2",
  };
}

export function flyerTypographyScale(draft: FlyerDraftState): "normal" | "compact" {
  return draft.layoutOptions.compactMode ? "compact" : "normal";
}
